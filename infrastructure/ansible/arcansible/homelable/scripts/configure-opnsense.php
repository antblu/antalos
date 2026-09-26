<?php
require_once('/usr/local/etc/inc/config.inc');
require_once('/usr/local/etc/inc/plugins.inc');
use OPNsense\Core\Config;
use OPNsense\Firewall\Filter;
use OPNsense\Unbound\Unbound;
$c=Config::getInstance(); $c->lock();
$f=new Filter();
foreach (['10.20.0.0/24','10.40.0.0/24'] as $i=>$subnet) {
 foreach (['TCP','ICMP','UDP'] as $j=>$proto) {
  $desc='Homelable Arc '.($proto==='UDP'?'DNS':$proto).' to '.$subnet;
  $node=null;
  foreach ($f->rules->rule->iterateItems() as $r) { if ((string)$r->description===$desc) { $node=$r; break; } }
  if ($node===null) $node=$f->rules->rule->Add();
  foreach (['enabled'=>'1','sequence'=>(string)(910+$i*3+$j),'action'=>'pass','quick'=>'1','interface'=>'opt3','direction'=>'in','ipprotocol'=>'inet','protocol'=>$proto,'source_net'=>'10.30.0.28','destination_net'=>$subnet,'destination_port'=>$proto==='UDP'?'53':'','log'=>'1','description'=>$desc] as $key=>$value) $node->$key=$value;
 }
}
$u=new Unbound(); $host=null;
foreach ($u->hosts->host->iterateItems() as $h) { if ((string)$h->hostname==='homelable' && (string)$h->domain==='antblu.net') {$host=$h;break;} }
if ($host===null) $host=$u->hosts->host->Add();
foreach (['enabled'=>'1','hostname'=>'homelable','domain'=>'antblu.net','rr'=>'A','server'=>'10.30.0.27','addptr'=>'0','description'=>'Homelable via Debian Left Caddy'] as $key=>$value) $host->$key=$value;
foreach ([$f,$u] as $m) { $errors=$m->performValidation(); if (count($errors)>0) { foreach ($errors as $err) echo (string)$err.'\n'; $c->unlock(); exit(1); } }
$f->serializeToConfig(); $u->serializeToConfig(); $c->save('Homelable DNS and source-specific inter-VLAN discovery'); $c->unlock();
echo "Homelable DNS and six source-specific TCP/ICMP/DNS rules saved\n";
