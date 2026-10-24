<?php

namespace App\Services\Auth;

use App\Factory\UserFactory;
use App\Libraries\OAuth\OAuth;
use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Socialite\Two\User as Identity;

final class AntIdJitProvisioner
{
    public static function provision(Identity $identity): User
    {
        $companyId = filter_var(config('services.oidc.jit_company_id', getenv('OIDC_JIT_COMPANY_ID')), FILTER_VALIDATE_INT);
        $email = trim((string) $identity->getEmail());
        if (!$companyId || !$identity->getId() || !filter_var($email, FILTER_VALIDATE_EMAIL)
            || ($identity->getRaw()['email_verified'] ?? false) !== true) {
            throw new \DomainException('antID must provide a verified email address for automatic provisioning.');
        }

        $groups = $identity->getRaw()['groups'] ?? [];
        if (!is_array($groups) || !in_array('invoice-ninja-users', $groups, true)) {
            throw new \DomainException('Invoice Ninja application membership is required.');
        }
        $administrator = in_array('invoice-ninja-admins', $groups, true);

        return DB::transaction(function () use ($companyId, $identity, $email, $administrator): User {
            // Serialize first logins so repeated/concurrent callbacks cannot duplicate users.
            $company = Company::query()->whereKey($companyId)->lockForUpdate()->first();
            if (!$company) {
                throw new \DomainException('The configured antID company is unavailable.');
            }

            $user = User::withTrashed()->where('oauth_provider_id', 'oidc')
                ->where('oauth_user_id', $identity->getId())->first();
            if ($user) {
                if ($user->trashed() || $user->is_deleted || $user->account_id != $company->account_id) {
                    throw new \DomainException('This antID identity cannot join the configured company.');
                }
                $membership = $user->companies()->where('companies.id', $company->id)->first();
                if (!$membership) {
                    throw new \DomainException('This identity is not a member of the configured company.');
                }
                // Company ownership is a separate recovery/business role.
                // Synchronize administrator access, never transfer ownership.
                $user->companies()->updateExistingPivot($company->id, ['is_admin' => $administrator]);
                return $user;
            }

            // Never duplicate, reactivate, move, or rebind an existing email identity.
            if (User::withTrashed()->where('email', $email)->exists()) {
                throw new \DomainException('This email already belongs to an Invoice Ninja account. Ask an administrator to review its sign-in linkage.');
            }

            $name = OAuth::splitName($identity->getName() ?? '');
            $user = UserFactory::create($company->account_id);
            $user->email = $email;
            $user->first_name = $name[0];
            $user->last_name = $name[1];
            $user->oauth_provider_id = 'oidc';
            $user->oauth_user_id = $identity->getId();
            $user->email_verified_at = now();
            $user->password = Hash::make(Str::random(64));
            $user->has_password = false;
            $user->user_logged_in_notification = false;
            $user->save();
            $user->companies()->attach($company->id, [
                'account_id' => $company->account_id,
                'is_owner' => false,
                'is_admin' => $administrator,
                'is_locked' => false,
                'permissions' => '',
                'notifications' => (object) ['email' => []],
                'settings' => (object) [],
            ]);

            return $user->fresh();
        }, 3);
    }
}
