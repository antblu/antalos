<?php
namespace App\Authentication\LegacyHandler {
    class UserHandler { public function init(): void {} public function close(): void {} }
}
namespace {
    require '/var/www/html/vendor/autoload.php';
    require $argv[1];
    class BeanFactory {
        public static $account;
        public static function newBean($module) { return new class {
            public function getSystemUser() { return (object)['id'=>'system','is_admin'=>true]; }
        }; }
        public static function getBean($module,$id) { return self::$account; }
    }
    function is_admin($user) { return $user->is_admin; }
    BeanFactory::$account = new class {
        public $id='fixture'; public $is_admin=false; public $saves=0;
        public function isEnabled() { return true; }
        public function save() { $this->saves++; }
    };
    $user = new class implements \Symfony\Component\Security\Core\User\UserInterface {
        public $admin=false;
        public function getId() { return 'fixture'; }
        public function getRoles(): array { return ['ROLE_USER']; }
        public function getUserIdentifier(): string { return 'fixture'; }
        public function eraseCredentials(): void {}
        public function setIsAdmin($admin) { $this->admin=$admin; }
    };
    $subscriber = new \App\Extension\antalos\backend\Security\Saml\SamlRoleSubscriber(new \App\Authentication\LegacyHandler\UserHandler());
    $execute = function($groups) use($subscriber,$user) {
        $passport = new \Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport(
            new \Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge('fixture', fn()=> $user),
            [new \Nbgrp\OneloginSamlBundle\Security\Http\Authenticator\Passport\Badge\SamlAttributesBadge([
                'http://schemas.xmlsoap.org/claims/Group'=>$groups])]);
        $event = (new \ReflectionClass(\Symfony\Component\Security\Http\Event\CheckPassportEvent::class))->newInstanceWithoutConstructor();
        (new \ReflectionProperty($event,'passport'))->setValue($event,$passport);
        $subscriber->synchronize($event);
    };
    $execute(['suitecrm-users','suitecrm-admins']);
    if (!$user->admin || !BeanFactory::$account->is_admin) { throw new \RuntimeException('Admin grant failed'); }
    $execute(['suitecrm-users']);
    if ($user->admin || BeanFactory::$account->is_admin) { throw new \RuntimeException('Admin removal failed'); }
    try { $execute([]); throw new \RuntimeException('Outsider accepted'); }
    catch (\Symfony\Component\Security\Core\Exception\BadCredentialsException) {}
    if (BeanFactory::$account->saves!==2) { throw new \RuntimeException('Unexpected native writes'); }
    echo "SUITECRM_ROLE_CHECK administrator grant, removal and outsider rejection passed\n";
}
