<?php
// Explicit operator action: allow VLAN 30 ICMP only to switch management.
require_once('/usr/local/etc/inc/config.inc');
require_once('/usr/local/etc/inc/plugins.inc');
use OPNsense\Core\Config;
use OPNsense\Firewall\Filter;
$c=Config::getInstance(); $c->lock();
$f=new Filter(); $node=null;
$description='VLAN30 ICMP only to Juniper management';
foreach ($f->rules->rule->iterateItems() as $r) {
    if ((string)$r->description===$description) { $node=$r; break; }
}
if ($node===null) $node=$f->rules->rule->Add();
foreach (['enabled'=>'1','sequence'=>'909','action'=>'pass','quick'=>'1','interface'=>'opt3','direction'=>'in','ipprotocol'=>'inet','protocol'=>'ICMP','source_net'=>'10.30.0.0/24','destination_net'=>'10.20.0.2','destination_port'=>'','log'=>'1','description'=>$description] as $key=>$value) $node->$key=$value;
$errors=$f->performValidation();
if (count($errors)>0) {
    foreach ($errors as $err) echo (string)$err."\n";
    $c->unlock(); exit(1);
}
$f->serializeToConfig(); $c->save('VLAN 30 ICMP-only access to Juniper management'); $c->unlock();
echo "Saved one ICMP-only VLAN30-to-switch rule\n";
