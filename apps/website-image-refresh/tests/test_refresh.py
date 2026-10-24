"""Run with python3 -m unittest discover -s apps/website-image-refresh/tests -v."""
import base64
import copy
import json
import types
import unittest
from pathlib import Path
from unittest.mock import patch

# Exercise the exact script mounted by the CronJob, without a YAML dependency.
config = (Path(__file__).resolve().parents[1] / "config.yaml").read_text()
script = "\n".join(line[4:] for line in config.split("  refresh.py: |\n", 1)[1].splitlines())
refresh = types.ModuleType("refresh")
exec(compile(script, "refresh.py", "exec"), refresh.__dict__)

IMAGE = "ghcr.io/antblu/emiliany:main"
DIGEST = "sha256:" + "a" * 64
TARGET = {"namespace": "emiliany", "deployment": "emiliany", "container": "storefront", "pullSecret": "emiliany-registry"}
DEPLOYMENT = {
    "metadata": {"resourceVersion": "42"},
    "spec": {"template": {
        "metadata": {"labels": {"app": "emiliany"}},
        "spec": {"containers": [{"name": "storefront", "image": IMAGE, "imagePullPolicy": "Always"}]},
    }},
}
SECRET = {"data": {".dockerconfigjson": base64.b64encode(json.dumps({
    "auths": {"ghcr.io": {"auth": "dXNlcjpwYXNz"}},
}).encode()).decode()}}


class RefreshTests(unittest.TestCase):
    def run_refresh(self, deployment, digest=DIGEST):
        with patch.object(refresh, "kube", side_effect=[deployment, SECRET, {}]) as kube, patch.object(refresh, "registry_digest", return_value=digest):
            refresh.refresh(TARGET)
        return kube

    def test_changed_digest_requests_rollout_without_changing_source_fields(self):
        kube = self.run_refresh(copy.deepcopy(DEPLOYMENT))
        self.assertEqual(kube.call_count, 3)
        path, method, body = kube.call_args.args
        self.assertEqual(path, "/apis/apps/v1/namespaces/emiliany/deployments/emiliany")
        self.assertEqual(method, "PATCH")
        self.assertEqual(body, {
            "metadata": {"resourceVersion": "42"},
            "spec": {"template": {"metadata": {"annotations": {refresh.ANNOTATION: IMAGE + "@" + DIGEST}}}},
        })

    def test_unchanged_digest_does_not_restart_pods(self):
        deployment = copy.deepcopy(DEPLOYMENT)
        deployment["spec"]["template"]["metadata"]["annotations"] = {refresh.ANNOTATION: IMAGE + "@" + DIGEST}
        self.assertEqual(self.run_refresh(deployment).call_count, 2)

    def test_same_digest_after_source_tag_change_still_refreshes(self):
        deployment = copy.deepcopy(DEPLOYMENT)
        deployment["spec"]["template"]["metadata"]["annotations"] = {refresh.ANNOTATION: IMAGE.replace(":main", ":previous") + "@" + DIGEST}
        self.assertEqual(self.run_refresh(deployment).call_count, 3)

    def test_pinned_rollback_is_preserved(self):
        deployment = copy.deepcopy(DEPLOYMENT)
        deployment["spec"]["template"]["spec"]["containers"][0]["image"] += "@" + DIGEST
        with patch.object(refresh, "kube", return_value=deployment) as kube, patch.object(refresh, "registry_digest") as registry:
            refresh.refresh(TARGET)
        self.assertEqual(kube.call_count, 1)
        registry.assert_not_called()

    def test_cached_image_policy_cannot_silently_skip_update(self):
        deployment = copy.deepcopy(DEPLOYMENT)
        deployment["spec"]["template"]["spec"]["containers"][0]["imagePullPolicy"] = "IfNotPresent"
        with self.assertRaises(ValueError):
            self.run_refresh(deployment)

    def test_registry_failure_does_not_patch_deployment(self):
        with patch.object(refresh, "kube", side_effect=[copy.deepcopy(DEPLOYMENT), SECRET]) as kube, patch.object(refresh, "registry_digest", side_effect=TimeoutError):
            with self.assertRaises(TimeoutError):
                refresh.refresh(TARGET)
        self.assertEqual(kube.call_count, 2)

    def test_public_registry_request_and_digest_validation(self):
        responses = [({}, b'{"token":"temporary"}'), ({"Docker-Content-Digest": DIGEST}, b'{}')]
        with patch.object(refresh, "request", side_effect=responses) as request:
            self.assertEqual(refresh.registry_digest(IMAGE), DIGEST)
        self.assertEqual(request.call_args_list[0].args[1], {})
        self.assertEqual(request.call_args_list[1].args[1]["Authorization"], "Bearer temporary")
        with patch.object(refresh, "request", side_effect=[responses[0], ({}, b'{}')]):
            with self.assertRaises(ValueError):
                refresh.registry_digest(IMAGE)

    def test_private_registry_auth_is_only_sent_to_token_endpoint(self):
        responses = [({}, b'{"token":"temporary"}'), ({"Docker-Content-Digest": DIGEST}, b'{}')]
        with patch.object(refresh, "request", side_effect=responses) as request:
            self.assertEqual(refresh.registry_digest(IMAGE, SECRET), DIGEST)
        self.assertEqual(request.call_args_list[0].args[1]["Authorization"], "Basic dXNlcjpwYXNz")
        self.assertEqual(request.call_args_list[1].args[1]["Authorization"], "Bearer temporary")

    def test_failure_in_one_site_does_not_skip_other_site(self):
        targets = [TARGET, {"namespace": "docs"}]
        with patch.object(refresh.Path, "read_text", return_value=json.dumps(targets)), patch.object(refresh, "refresh", side_effect=[TimeoutError, None]) as run:
            self.assertEqual(refresh.main(), 1)
        self.assertEqual(run.call_count, 2)

    def test_concurrent_source_change_is_retried_next_run(self):
        with patch.object(refresh, "kube", side_effect=[copy.deepcopy(DEPLOYMENT), SECRET, RuntimeError("Conflict")]), patch.object(refresh, "registry_digest", return_value=DIGEST):
            with self.assertRaisesRegex(RuntimeError, "Conflict"):
                refresh.refresh(TARGET)


if __name__ == "__main__":
    unittest.main()
