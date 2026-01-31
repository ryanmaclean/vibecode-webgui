import hashlib
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts.security.check_branch_protection import evaluate_branch_protection
from scripts.security.migrate_secrets_to_keychain import KeychainMigrator, parse_env_file
from scripts.security.verify_binary_download import VerificationError, verify_binary_download


class VerifyBinaryDownloadTests(unittest.TestCase):
    def test_verify_sha256_and_copy(self) -> None:
        payload = b"secure\n"
        expected_hash = hashlib.sha256(payload).hexdigest()

        downloads: list[Path] = []

        def fake_download(url: str, destination: Path) -> Path:
            destination.parent.mkdir(parents=True, exist_ok=True)
            if destination.suffix == ".checksum":
                destination.write_text(f"{expected_hash}  {destination.name}\n", encoding="utf-8")
            else:
                destination.write_bytes(payload)
            downloads.append(destination)
            return destination

        with mock.patch(
            "scripts.security.verify_binary_download.download_file",
            side_effect=fake_download,
        ):
            output_file = Path(tempfile.gettempdir()) / "verified-binary"
            if output_file.exists():
                output_file.unlink()
            try:
                result = verify_binary_download(
                    name="kubectl",
                    binary_url="https://example/bin",
                    checksum_type="sha256",
                    checksum_url="https://example/bin.sha256",
                    signature_type=None,
                    signature_url=None,
                    cert_identity=None,
                    cert_oidc_issuer=None,
                    output_path=str(output_file),
                )
                self.assertEqual(result, output_file)
                self.assertTrue(output_file.exists())
                self.assertEqual(output_file.read_bytes(), payload)
                self.assertGreaterEqual(len(downloads), 2)
            finally:
                if output_file.exists():
                    output_file.unlink()

    def test_verify_binary_download_raises_on_checksum_failure(self) -> None:
        payload = b"tampered"
        wrong_hash = hashlib.sha256(b"other").hexdigest()

        def fake_download(url: str, destination: Path) -> Path:
            destination.parent.mkdir(parents=True, exist_ok=True)
            if destination.suffix == ".checksum":
                destination.write_text(f"{wrong_hash}\n", encoding="utf-8")
            else:
                destination.write_bytes(payload)
            return destination

        with mock.patch(
            "scripts.security.verify_binary_download.download_file",
            side_effect=fake_download,
        ):
            with self.assertRaises(VerificationError):
                verify_binary_download(
                    name="kubectl",
                    binary_url="https://example/bin",
                    checksum_type="sha256",
                    checksum_url="https://example/bin.sha256",
                )


class FakeKeychainMigrator(KeychainMigrator):
    def __init__(self) -> None:
        super().__init__(service="test")
        self._storage: dict[str, str] = {}

    def _run_security(self, *args: str, check: bool = True, capture: bool = False):  # type: ignore[override]
        command = args[0]
        if command == "delete-generic-password":
            account = args[args.index("-a") + 1]
            self._storage.pop(account, None)
            return subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")
        if command == "add-generic-password":
            account = args[args.index("-a") + 1]
            value = args[args.index("-w") + 1]
            self._storage[account] = value
            return subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")
        if command == "find-generic-password":
            account = args[args.index("-a") + 1]
            if account not in self._storage:
                raise subprocess.CalledProcessError(returncode=44, cmd=args)
            return subprocess.CompletedProcess(args=[], returncode=0, stdout=self._storage[account], stderr="")
        return subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")


class KeychainMigratorTests(unittest.TestCase):
    def test_store_and_read_secret(self) -> None:
        migrator = FakeKeychainMigrator()
        self.assertTrue(migrator.store_secret("NEXTAUTH_SECRET", "value"))
        self.assertEqual(migrator.read_secret("NEXTAUTH_SECRET"), "value")


class EnvParsingTests(unittest.TestCase):
    def test_parse_env_file_handles_quotes_and_comments(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env_path = Path(tmp) / ".env"
            env_path.write_text(
                """
# Comment line
export NEXTAUTH_SECRET="super secret"
DATABASE_URL=postgres://user:pass@localhost/db # inline comment
SESSION_SECRET='space value'
                """.strip(),
                encoding="utf-8",
            )
            values = parse_env_file(env_path)
            self.assertEqual(values["NEXTAUTH_SECRET"], "super secret")
            self.assertEqual(values["SESSION_SECRET"], "space value")
            self.assertEqual(values["DATABASE_URL"], "postgres://user:pass@localhost/db")


class BranchProtectionEvaluationTests(unittest.TestCase):
    def test_evaluate_branch_protection_scores_features(self) -> None:
        data = {
            "required_pull_request_reviews": {
                "required_approving_review_count": 1,
                "dismiss_stale_reviews": True,
                "require_code_owner_reviews": True,
            },
            "required_status_checks": {
                "strict": True,
                "contexts": [
                    "validate-ci-config",
                    "quick-validation",
                    "security-check",
                    "build-check",
                ],
            },
            "allow_force_pushes": {"enabled": False},
            "allow_deletions": {"enabled": False},
            "required_signatures": {"enabled": True},
            "enforce_admins": {"enabled": True},
            "required_linear_history": {"enabled": True},
            "required_conversation_resolution": {"enabled": True},
        }
        result = evaluate_branch_protection(data)
        self.assertGreaterEqual(result.score, 8)
        self.assertEqual(result.errors, [])
        self.assertEqual(result.warnings, [])

    def test_evaluate_branch_protection_flags_missing_reviews(self) -> None:
        data = {
            "required_pull_request_reviews": {"required_approving_review_count": 0},
            "required_status_checks": None,
            "allow_force_pushes": {"enabled": True},
            "allow_deletions": {"enabled": True},
            "required_signatures": {"enabled": False},
            "enforce_admins": {"enabled": False},
        }
        result = evaluate_branch_protection(data)
        self.assertIn("Pull request reviews not required", " ".join(result.errors))
        self.assertLess(result.score, 4)


if __name__ == "__main__":
    unittest.main()
