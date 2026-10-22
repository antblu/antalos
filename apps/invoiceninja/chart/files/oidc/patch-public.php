<?php

// This UI build references OIDC translation keys missing from its English fallback.
$root = $argv[1] ?? '/var/www/html/public';
$anchor = 'google_sign_in:`Sign in with Google`,';
$translations = 'sign_in_with:`Sign in with {{provider}}`,sign_in_failed:`Sign in failed`,'
    . 'oidc_login_failed:`Unable to finish signing in. Please try again.`,oidc_missing_code:`The sign-in response is missing its code.`,'
    . 'oidc_no_token:`The sign-in response is missing its token.`,back_to_login:`Back to sign in`,signing_you_in:`Signing you in`,';
$found = 0;
foreach (glob($root . '/*.js') as $path) {
    $source = file_get_contents($path);
    if (!str_contains($source, $anchor)) {
        continue;
    }
    $found++;
    if (!str_contains($source, 'sign_in_with:')) {
        if (substr_count($source, $anchor) !== 1) {
            throw new RuntimeException('Unsupported Invoice Ninja UI translation layout.');
        }
        if (file_put_contents($path, str_replace($anchor, $anchor . $translations, $source)) === false) {
            throw new RuntimeException('Cannot install antID UI translations.');
        }
    }
}
if ($found !== 1) {
    throw new RuntimeException('Expected one Invoice Ninja English UI bundle; review the antID extension before upgrading.');
}
echo "antID UI translations installed.\n";
