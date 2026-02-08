<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Agent Action Service
 *
 * Core execution engine for the AI Super Agent.
 * Validates actions against the registry and executes them
 * by calling existing AdminController methods internally.
 */
class AgentActionService
{
    /**
     * Role hierarchy for permission checks
     */
    private const ROLE_HIERARCHY = [
        'employee' => 1,
        'delivery' => 1,
        'manager'  => 2,
        'owner'    => 3,
    ];

    /**
     * Validate an action before execution
     */
    public function validateAction(string $actionId, array $params, User $user): array
    {
        $registry = config('agent_actions');

        if (!isset($registry[$actionId])) {
            return ['valid' => false, 'error' => 'פעולה לא קיימת: ' . $actionId];
        }

        $def = $registry[$actionId];

        // Role check
        if (!$this->hasRequiredRole($user, $def['required_role'])) {
            return [
                'valid' => false,
                'error' => 'אין לך הרשאה לבצע פעולה זו. נדרש תפקיד: ' . $def['required_role'],
            ];
        }

        // Required params check
        foreach ($def['params'] as $key => $paramDef) {
            if (($paramDef['required'] ?? false) && !isset($params[$key])) {
                return [
                    'valid' => false,
                    'error' => 'חסר פרמטר חובה: ' . ($paramDef['label_he'] ?? $key),
                ];
            }

            // Type validation for provided params
            if (isset($params[$key])) {
                $typeError = $this->validateParamType($key, $params[$key], $paramDef);
                if ($typeError) {
                    return ['valid' => false, 'error' => $typeError];
                }
            }
        }

        return ['valid' => true];
    }

    /**
     * Execute a validated action
     */
    public function executeAction(string $actionId, array $params, User $user): array
    {
        $def = config("agent_actions.{$actionId}");

        if (!$def) {
            return ['success' => false, 'message' => 'פעולה לא קיימת'];
        }

        // Build a synthetic Request with the params
        $request = Request::create('/', $def['http_method'], $params);
        $request->setUserResolver(fn() => $user);

        // Ensure tenant context is set
        if (!app()->has('tenant_id') && $user->restaurant) {
            app()->instance('tenant_id', $user->restaurant->tenant_id);
        }

        // Resolve the controller
        $controller = app($def['controller']);
        $method = $def['method'];

        // Build route params (for methods like updateCategory($request, $id))
        $routeArgs = [$request];
        if (isset($def['route_params'])) {
            foreach ($def['route_params'] as $rp) {
                $routeArgs[] = $params[$rp] ?? null;
            }
        }

        Log::info('Agent executing action', [
            'action_id' => $actionId,
            'user_id'   => $user->id,
            'params'    => $params,
        ]);

        // Call the controller method
        $response = $controller->$method(...$routeArgs);

        // Parse the response
        $data = json_decode($response->getContent(), true);

        Log::info('Agent action result', [
            'action_id' => $actionId,
            'success'   => $data['success'] ?? false,
            'message'   => $data['message'] ?? '',
        ]);

        return $data;
    }

    /**
     * Get the action definition from the registry
     */
    public function getActionDefinition(string $actionId): ?array
    {
        return config("agent_actions.{$actionId}");
    }

    /**
     * Build the action instructions for the AI system prompt
     */
    public function buildActionInstructions(): string
    {
        $registry = config('agent_actions', []);
        $instructions = "## פעולות שניתן לבצע (Agent Actions)\n";
        $instructions .= "כאשר המשתמש מבקש לבצע פעולה (ליצור, לעדכן, למחוק, לשנות), עליך להציע את הפעולה בפורמט JSON מובנה.\n";
        $instructions .= "הוסף את ה-JSON בסוף התשובה שלך בפורמט הבא:\n\n";
        $instructions .= "<!-- ACTIONS_JSON: [{\"action_id\": \"...\", \"display_name\": \"...\", \"description\": \"...\", \"params\": {...}}] -->\n\n";
        $instructions .= "פעולות זמינות:\n";

        foreach ($registry as $actionId => $def) {
            $paramsList = [];
            foreach ($def['params'] as $key => $paramDef) {
                $required = ($paramDef['required'] ?? false) ? '*' : '';
                $paramsList[] = "{$key}{$required}";
            }
            $paramsStr = implode(', ', $paramsList);
            $instructions .= "- {$actionId}: {$def['name_he']} (params: {$paramsStr})\n";
        }

        $instructions .= "\nחשוב:\n";
        $instructions .= "1. הצע פעולה רק כשהמשתמש מבקש לבצע שינוי ספציפי\n";
        $instructions .= "2. מלא את ה-params מתוך הקשר השיחה ונתוני התפריט (השתמש ב-ID של הפריטים!)\n";
        $instructions .= "3. תמיד תאר בעברית מה הפעולה תעשה ב-display_name וב-description\n";
        $instructions .= "4. ניתן להציע מספר פעולות בו-זמנית\n";
        $instructions .= "5. אל תציע פעולה אם לא ברור מה המשתמש רוצה - שאל שאלות הבהרה\n";

        return $instructions;
    }

    /**
     * Parse proposed actions from AI response text
     */
    public function parseProposedActions(string $content): array
    {
        if (!preg_match('/<!-- ACTIONS_JSON:\s*(\[.*?\])\s*-->/s', $content, $matches)) {
            return [];
        }

        $actions = json_decode($matches[1], true);
        if (!is_array($actions)) {
            return [];
        }

        $registry = config('agent_actions', []);
        $validated = [];

        foreach ($actions as $action) {
            $actionId = $action['action_id'] ?? '';
            if (!isset($registry[$actionId])) {
                continue;
            }

            $def = $registry[$actionId];
            $validated[] = [
                'action_id'     => $actionId,
                'display_name'  => $action['display_name'] ?? $def['name_he'],
                'description'   => $action['description'] ?? $def['description_he'],
                'params'        => $action['params'] ?? [],
                'risk'          => $def['risk'],
                'approval_type' => $def['approval_type'],
            ];
        }

        return $validated;
    }

    /**
     * Strip proposed actions JSON block from display text
     */
    public function stripActionsFromContent(string $content): string
    {
        return trim(preg_replace('/\s*<!-- ACTIONS_JSON:.*?-->/s', '', $content));
    }

    /**
     * Check if user has the required role
     */
    private function hasRequiredRole(User $user, string $requiredRole): bool
    {
        $userLevel = self::ROLE_HIERARCHY[$user->role] ?? 0;
        $requiredLevel = self::ROLE_HIERARCHY[$requiredRole] ?? 99;
        return $userLevel >= $requiredLevel;
    }

    /**
     * Validate parameter type
     */
    private function validateParamType(string $key, mixed $value, array $paramDef): ?string
    {
        $type = $paramDef['type'] ?? 'string';
        $labelHe = $paramDef['label_he'] ?? $key;

        switch ($type) {
            case 'integer':
                if (!is_numeric($value)) {
                    return "הפרמטר '{$labelHe}' חייב להיות מספר שלם";
                }
                break;

            case 'number':
                if (!is_numeric($value)) {
                    return "הפרמטר '{$labelHe}' חייב להיות מספר";
                }
                break;

            case 'boolean':
                if (!is_bool($value) && !in_array($value, [0, 1, '0', '1', 'true', 'false'], true)) {
                    return "הפרמטר '{$labelHe}' חייב להיות ערך בוליאני";
                }
                break;

            case 'enum':
                $allowedValues = $paramDef['values'] ?? [];
                if (!in_array($value, $allowedValues, true)) {
                    $valuesStr = implode(', ', $allowedValues);
                    return "הפרמטר '{$labelHe}' חייב להיות אחד מ: {$valuesStr}";
                }
                break;
        }

        return null;
    }
}
