
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import io

from scripts.lib import logging as script_logging


def test_script_logger_outputs_expected_format():
    stdout = io.StringIO()
    stderr = io.StringIO()
    logger = script_logging.ScriptLogger(use_color=False, stream=stdout, error_stream=stderr)

    logger.info("info message")
    logger.success("success message")
    logger.warn("warn message")
    logger.error("error message")
    logger.step("step message")

    out = stdout.getvalue()
    err = stderr.getvalue()

    assert "INFO:" in out
    assert "SUCCESS:" in out
    assert "WARNING:" in out
    assert "==>" in out
    assert "ERROR:" in err


def test_module_level_helpers_use_singleton():
    stdout = io.StringIO()
    stderr = io.StringIO()
    original = script_logging._LOGGER
    script_logging._LOGGER = script_logging.ScriptLogger(
        use_color=False,
        stream=stdout,
        error_stream=stderr,
    )

    script_logging.log_info("hello")
    script_logging.log_warn("warn")
    script_logging.log_warning("warn2")
    script_logging.log_success("good")
    script_logging.log_error("bad")
    script_logging.log_step("step")

    assert "hello" in stdout.getvalue()
    assert "warn" in stdout.getvalue()
    assert "bad" in stderr.getvalue()

    script_logging._LOGGER = original