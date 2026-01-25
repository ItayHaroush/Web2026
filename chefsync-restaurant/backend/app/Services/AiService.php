<?php

namespace App\Services;

use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Unified AI Service - Routes to Copilot (local) or OpenAI (production)
 * 
 * Architecture:
 * - Local Development: Uses Copilot CLI via CopilotService
 * - Production/Server: Uses OpenAI API via OpenAiService
 * 
 * Configuration via AI_PROVIDER env variable:
 * - 'copilot' → Local development with GitHub Copilot CLI
 * - 'openai'  → Production with OpenAI HTTP API
 */
class AiService
{
    private string $provider;
    private string $tenantId;
    private Restaurant $restaurant;
    private ?User $user;

    /**
     * Initialize AI Service with automatic provider selection
     */
    public function __construct(string $tenantId, Restaurant $restaurant, ?User $user = null)
    {
        $this->tenantId = $tenantId;
        $this->restaurant = $restaurant;
        $this->user = $user;
        
        // Get provider from env (copilot or openai)
        $this->provider = config('ai.provider', 'copilot');
        
        // SECURITY: Block Copilot in production
        if ($this->provider === 'copilot' && app()->environment('production')) {
            Log::critical('SECURITY: Attempted to use Copilot CLI in production environment', [
                'tenant_id' => $tenantId,
                'environment' => app()->environment()
            ]);
            throw new \Exception('Copilot CLI is not allowed in production. Use OpenAI provider.');
        }

        Log::info('AI Service initialized', [
            'provider' => $this->provider,
            'tenant_id' => $tenantId,
            'environment' => app()->environment()
        ]);
    }

    /**
     * Generate menu item description
     */
    public function generateDescription(array $menuItemData, bool $forceRegenerate = false): array
    {
        return $this->getProvider()->generateDescription($menuItemData, $forceRegenerate);
    }

    /**
     * Chat with Super Admin
     */
    public function chatWithSuperAdmin(string $message, array $context = [], ?string $preset = null): array
    {
        return $this->getProvider()->chatWithSuperAdmin($message, $context, $preset);
    }

    /**
     * Chat with Restaurant
     */
    public function chatWithRestaurant(string $message, array $context = [], ?string $preset = null): array
    {
        return $this->getProvider()->chatWithRestaurant($message, $context, $preset);
    }

    /**
     * Get dashboard insights
     */
    public function getDashboardInsights(array $context): array
    {
        return $this->getProvider()->getDashboardInsights($context);
    }

    /**
     * Recommend price for menu item
     */
    public function recommendPrice(array $menuItemData, array $context = []): array
    {
        return $this->getProvider()->recommendPrice($menuItemData, $context);
    }

    /**
     * Get suggested actions for restaurant
     */
    public function getRestaurantSuggestedActions(array $context = [], ?string $preset = null): array
    {
        return $this->getProvider()->getRestaurantSuggestedActions($context, $preset);
    }

    /**
     * Get credits status (static method - uses BaseAiService)
     */
    public static function getCreditsStatus(Restaurant $restaurant): array
    {
        return BaseAiService::getCreditsStatus($restaurant);
    }

    /**
     * Get usage statistics (static method - uses BaseAiService)
     */
    public static function getUsageStats(Restaurant $restaurant, ?string $startDate = null, ?string $endDate = null): array
    {
        return BaseAiService::getUsageStats($restaurant, $startDate, $endDate);
    }

    /**
     * Get the underlying provider instance
     */
    private function getProvider()
    {
        if ($this->provider === 'openai') {
            return new OpenAiService($this->tenantId, $this->restaurant, $this->user);
        }
        
        return new CopilotService($this->tenantId, $this->restaurant, $this->user);
    }

    /**
     * Get current provider name
     */
    public function getProviderName(): string
    {
        return $this->provider;
    }
}
