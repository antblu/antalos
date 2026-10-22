<?php

// Apply before the image entrypoint caches Laravel's configuration.
$root = '/var/www/html';
$path = $root . '/app/Http/Controllers/Auth/LoginController.php';
$source = file_get_contents($path);
$marker = '// antalos-antid-jit-v1';
$needle = <<<'PHP'
        if (!$user) {
            return response()->json(['message' => 'No Invoice Ninja account is linked to this OIDC identity. Ask an administrator to invite you first.'], 400);
        }
PHP;
$replacement = <<<'PHP'
        // antalos-antid-jit-v1
        if (!$user && config('services.oidc.jit_company_id', getenv('OIDC_JIT_COMPANY_ID'))) {
            try {
                $user = \App\Services\Auth\AntIdJitProvisioner::provision($socialite_user);
            } catch (\DomainException $e) {
                return response()->json(['message' => $e->getMessage()], 403);
            }
        }

PHP;

if (!str_contains($source, $marker)) {
    // Refuse incompatible upstream changes instead of silently disabling JIT.
    if (substr_count($source, $needle) !== 1) {
        throw new RuntimeException('Unsupported Invoice Ninja OIDC callback; review the antID extension before upgrading.');
    }
    $source = str_replace($needle, $replacement . $needle, $source);
    // An existing different OIDC subject must never be rebound using email alone.
    $link = "(!\$email_user->oauth_provider_id || \$email_user->oauth_provider_id === 'oidc')";
    if (substr_count($source, $link) !== 1) {
        throw new RuntimeException('Unsupported Invoice Ninja OIDC email linkage.');
    }
    $source = str_replace($link, '(!$email_user->oauth_provider_id)', $source);
}

$helper = $root . '/app/Services/Auth/AntIdJitProvisioner.php';
if (!copy(__DIR__ . '/AntIdJitProvisioner.php', $helper)) {
    throw new RuntimeException('Cannot install antID JIT provisioner.');
}
if (file_put_contents($path, $source) === false) {
    throw new RuntimeException('Cannot install antID OIDC callback.');
}
echo "antID JIT extension installed.\n";
