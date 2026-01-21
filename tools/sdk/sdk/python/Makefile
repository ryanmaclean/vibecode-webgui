.PHONY: install test lint format type-check clean build publish docs

# Installation
install:
	pip install -e ".[dev,cli,docs]"

install-prod:
	pip install -e .

# Testing
test:
	pytest -v

test-cov:
	pytest --cov=vibecode_agents --cov-report=html --cov-report=term

test-watch:
	pytest-watch

# Code Quality
lint:
	ruff check src/ tests/
	black --check src/ tests/

format:
	black src/ tests/
	ruff check --fix src/ tests/

type-check:
	mypy src/vibecode_agents

# Security
security:
	bandit -r src/
	safety check

# Cleanup
clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info
	rm -rf .pytest_cache/
	rm -rf .mypy_cache/
	rm -rf htmlcov/
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

# Build
build: clean
	python -m build

# Documentation
docs:
	mkdocs serve

docs-build:
	mkdocs build

# Publishing
publish-test: build
	twine upload --repository testpypi dist/*

publish: build
	twine upload dist/*

# Development
dev:
	pip install -e ".[dev,cli,docs]"
	pre-commit install

# All checks before commit
check: lint type-check test
	@echo "All checks passed!"

# Quick check (skip slow tests)
quick-check: lint type-check
	pytest -m "not slow"

# CI checks
ci: lint type-check test-cov security
	@echo "CI checks complete!"
