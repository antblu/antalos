<?php

// Run inside the matching Invoice Ninja image; all fixture writes roll back.
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
require_once $argv[1];

use App\Models\User;
use App\Models\CompanyUser;
use App\Services\Auth\AntIdJitProvisioner;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Two\User as Identity;

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
    echo "PASS: $message\n";
}

function denied(Identity $identity, string $message): void
{
    try {
        AntIdJitProvisioner::provision($identity);
    } catch (DomainException $e) {
        check(true, $message);
        return;
    }
    throw new RuntimeException($message);
}

$companyId = (int) ($argv[2] ?? 3);
config(['services.oidc.jit_company_id' => $companyId]);
$before = User::withTrashed()->count();
$suffix = bin2hex(random_bytes(12));
$identity = (new Identity())->setRaw(['email_verified' => true, 'groups' => ['invoice-ninja-users']])->map([
    'id' => 'antalos-test-' . $suffix,
    'name' => 'JIT Diagnostic',
    'email' => 'jit-' . $suffix . '@example.invalid',
]);

DB::beginTransaction();
try {
    $user = AntIdJitProvisioner::provision($identity);
    $cu = CompanyUser::query()->where('user_id', $user->id)->firstOrFail();
    check($cu->company_id == $companyId, 'new identity joins the configured existing company');
    check(!$cu->is_admin && !$cu->is_owner && $cu->permissions === '', 'new member has no admin, owner, or extra permissions');
    check(!$user->has_password && $user->oauth_provider_id === 'oidc', 'new member uses OIDC without a known local password');
    check(AntIdJitProvisioner::provision($identity)->id === $user->id, 'repeat identity reuses the same user');
    check(User::withTrashed()->count() === $before + 1, 'repeat login does not create duplicate users');

    $identity->setRaw(['email_verified' => true, 'groups' => ['invoice-ninja-users', 'invoice-ninja-admins']]);
    AntIdJitProvisioner::provision($identity);
    check((bool) $cu->fresh()->is_admin, 'administrator group grants native company administrator');
    $identity->setRaw(['email_verified' => true, 'groups' => ['invoice-ninja-users']]);
    AntIdJitProvisioner::provision($identity);
    check(!$cu->fresh()->is_admin, 'removing administrator group removes native administrator');

    // Exercise the installed callback after the already-validated Socialite boundary.
    $callbackIdentity = (new Identity())->setRaw(['email_verified' => true, 'groups' => ['invoice-ninja-users']])->map([
        'id' => 'antalos-callback-' . $suffix,
        'name' => 'Callback Diagnostic',
        'email' => 'callback-' . $suffix . '@example.invalid',
    ]);
    $socialite = Laravel\Socialite\Facades\Socialite::getFacadeRoot();
    Laravel\Socialite\Facades\Socialite::swap(new class($callbackIdentity) {
        public function __construct(private Identity $identity) {}
        public function driver(string $provider): self { return $this; }
        public function user(): Identity { return $this->identity; }
    });
    Illuminate\Support\Facades\Event::fake([App\Events\User\UserLoggedIn::class]);
    request()->headers->set('User-Agent', 'antalos-oidc-diagnostic');
    $loginKey = null;
    try {
        $controller = app(App\Http\Controllers\Auth\LoginController::class);
        $response = $controller->handleOidcProviderCallback();
        check($response instanceof Illuminate\Http\RedirectResponse, 'new identity completes the installed OIDC callback');
        $callbackUser = User::query()->where('oauth_user_id', $callbackIdentity->getId())->firstOrFail();
        $loginKey = $callbackUser->hashed_id . '_' . $callbackUser->account_id . '_logged_in';
        parse_str(parse_url($response->getTargetUrl(), PHP_URL_QUERY), $params);
        $code = $params['code'] ?? '';
        check(strlen($code) === 64, 'callback issues a short-lived exchange code');
        $request = Illuminate\Http\Request::create('/api/v1/oidc/exchange', 'POST', ['code' => $code]);
        $exchange = $controller->oidcExchange($request);
        check($exchange->getStatusCode() === 200, 'exchange code yields an authenticated company token');
        check($controller->oidcExchange($request)->getStatusCode() === 400, 'exchange code cannot be reused');
        $tokens = App\Models\CompanyToken::query()->where('user_id', $callbackUser->id)->get();
        check($tokens->count() === 1 && $tokens->first()->company_id == $companyId, 'callback creates only a token for the configured company');
    } finally {
        Laravel\Socialite\Facades\Socialite::swap($socialite);
        if ($loginKey) {
            Illuminate\Support\Facades\Cache::forget($loginKey);
        }
    }

    $unverified = clone $identity;
    $unverified->setRaw(['email_verified' => false]);
    denied($unverified, 'unverified email is denied');
    $conflict = clone $identity;
    $conflict->id .= '-other';
    denied($conflict, 'different subject cannot claim an existing email');
    $user->delete();
    denied($identity, 'deleted identities are not restored by JIT');
    config(['services.oidc.jit_company_id' => 0]);
    denied($identity, 'disabled or invalid company configuration is denied');
} finally {
    DB::rollBack();
}
check(User::withTrashed()->count() === $before, 'all diagnostic database writes rolled back');
