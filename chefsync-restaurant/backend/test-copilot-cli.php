<?php

use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$cliPath = config('copilot.cli_path'); // "/Users/itaymac/Library/Application Support/Code/User/globalStorage/github.copilot-chat/copilotCli/copilot"

echo "Checking CLI path: " . $cliPath . "\n";

if (!file_exists($cliPath)) {
    echo "ERROR: CLI path does not exist.\n";
    exit(1);
}

echo "CLI found. Running test prompt...\n";

$prompt = "What is the capital of France?";

// Replicating the logic from CopilotService - Testing correct syntax
$process = new Process(
    [$cliPath, '-s', '-p', $prompt],
    null,
    array_merge($_SERVER, [
        'HOME' => $_SERVER['HOME'] ?? getenv('HOME'),
        'PATH' => $_SERVER['PATH'] ?? getenv('PATH'),
        // 'GITHUB_TOKEN' => '...' // We might need this? 
    ])
);
$process->setTimeout(60);

try {
    $process->run();

    echo "Exit Code: " . $process->getExitCode() . "\n";
    echo "Output (STDOUT):\n" . $process->getOutput() . "\n";
    echo "Error Output (STDERR):\n" . $process->getErrorOutput() . "\n";
} catch (\Exception $e) {
    echo "EXCEPTION: " . $e->getMessage() . "\n";
}
