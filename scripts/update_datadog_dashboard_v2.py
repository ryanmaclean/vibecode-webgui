#!/usr/bin/env python3
"""Update Datadog dashboard with comprehensive Gas Town metrics - ENHANCED VERSION
Includes: OpenClaw, GitHub, MCP, SLOs, innovative visualizations"""

import argparse
import json
import os
import sys
import urllib.request


def load_env_file(path: str) -> None:
    if not path or not os.path.exists(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except OSError:
        return


load_env_file(os.getenv("DD_ENV_FILE", ".env.gastown.telemetry"))
load_env_file(".env.local")

DD_API_KEY = os.getenv("DD_API_KEY") or os.getenv("DATADOG_API_KEY")
DD_APP_KEY = os.getenv("DD_APP_KEY") or os.getenv("DATADOG_APP_KEY")
DD_SITE = os.getenv("DD_SITE", "datadoghq.com")
DASHBOARD_ID = os.getenv("DD_DASHBOARD_ID", "")

def create_widgets():
    """Build comprehensive widget list with innovative visualizations"""
    widgets = []

    # ============================================================
    # HERO SECTION - KEY METRICS AT A GLANCE
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# ⛽ GAS TOWN UNIFIED OPS\n**Multi-Agent Orchestration | OpenClaw Gateway | Claude Code | Ralph Loop**",
            "background_color": "vivid_green",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    # Key metrics with sparklines (timeseries in small format)
    widgets.append({
        "definition": {
            "title": "🏥 Town Health Score",
            "type": "query_value",
            "requests": [{"q": "avg:gastown.town.health{*}", "aggregator": "last", "conditional_formats": [
                {"comparator": ">=", "value": 80, "palette": "white_on_green"},
                {"comparator": ">=", "value": 50, "palette": "white_on_yellow"},
                {"comparator": "<", "value": 50, "palette": "white_on_red"}
            ]}],
            "precision": 0,
            "custom_unit": "/100",
            "autoscale": False
        }
    })

    widgets.append({
        "definition": {
            "title": "🦨 Active Polecats",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.polecats.active{*}", "aggregator": "last"}],
            "precision": 0,
            "autoscale": True
        }
    })

    # ============================================================
    # ROLES OVER TIME - HISTORICAL VIEW
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 📈 Roles Over Time\n**Historical Activity Tracking**",
            "background_color": "vivid_blue",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Polecats Over Time",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.polecats.active{*}", "display_type": "line", "style": {"palette": "dog_classic", "line_type": "solid", "line_width": "normal"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "All Roles Over Time",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.roles.active{*} by {role}", "display_type": "area"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Core Services Status",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.mayor.running{*}", "display_type": "line"},
                {"q": "avg:gastown.deacon.running{*}", "display_type": "line"},
                {"q": "avg:gastown.witness.running{*}", "display_type": "line"},
                {"q": "avg:gastown.refinery.running{*}", "display_type": "line"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Polecats by Type Over Time",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.polecats.active{*} by {rig_name}", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Total Roles Active",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.roles.total_active{*}", "display_type": "area", "style": {"palette": "green"}}
            ]
        }
    })

    # ============================================================
    # MULTI-HOST VIEW
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🖥️ Multi-Host Metrics\n**Aggregated from all hosts**",
            "background_color": "gray",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Polecats by Host",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.polecats.active{*} by {host}", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Memory by Host",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.memory.used_pct{*} by {host}", "display_type": "line"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "tmux Sessions by Host",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:gastown.tmux.sessions_active{*} by {host}, 10, 'mean', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Processes by Host",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:system.processes.number{*} by {host}, 10, 'mean', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "📿 Beads In Flight",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.beads.in_progress{*}", "aggregator": "last"}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "⚠️ Stuck Agents",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.agent.stuck_count{*}.as_count()", "conditional_formats": [
                {"comparator": ">", "value": 0, "palette": "white_on_red"},
                {"comparator": "<=", "value": 0, "palette": "white_on_green"}
            ]}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "💰 Cost (24h)",
            "type": "query_value",
            "requests": [{"q": "sum:ai_agent.cost.total_usd{*}.as_count() / 1000000"}],
            "precision": 2,
            "custom_unit": "$"
        }
    })

    widgets.append({
        "definition": {
            "title": "🔴 Error Rate",
            "type": "query_value",
            "requests": [{"q": "100 * sum:trace.http.request.errors{*}.as_count() / (sum:trace.http.request.hits{*}.as_count() + 1)", "conditional_formats": [
                {"comparator": ">", "value": 5, "palette": "white_on_red"},
                {"comparator": ">", "value": 1, "palette": "white_on_yellow"},
                {"comparator": "<=", "value": 1, "palette": "white_on_green"}
            ]}],
            "precision": 2,
            "custom_unit": "%"
        }
    })

    # ============================================================
    # OPENCLAW GATEWAY
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🦞 OpenClaw Gateway\n**AI Router | Load Balancer | Rate Limiter**",
            "background_color": "vivid_orange",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Gateway Health",
            "type": "query_value",
            "requests": [{"q": "avg:openclaw.gateway.health{*}", "aggregator": "last", "conditional_formats": [
                {"comparator": ">=", "value": 1, "palette": "white_on_green"},
                {"comparator": "<", "value": 1, "palette": "white_on_red"}
            ]}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "Requests Routed",
            "type": "timeseries",
            "requests": [
                {"q": "sum:openclaw.requests.routed{*} by {provider}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Routing Latency (p95)",
            "type": "timeseries",
            "requests": [
                {"q": "p95:openclaw.routing.latency_ms{*}", "display_type": "line"},
                {"q": "avg:openclaw.routing.latency_ms{*}", "display_type": "line"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Provider Selection",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:openclaw.provider.selected{*} by {provider}.as_count(), 10, 'sum', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Rate Limit Events",
            "type": "timeseries",
            "requests": [
                {"q": "sum:openclaw.ratelimit.triggered{*} by {provider}.as_count()", "display_type": "bars", "style": {"palette": "warm"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Fallback Triggers",
            "type": "query_value",
            "requests": [{"q": "sum:openclaw.fallback.count{*}.as_count()", "conditional_formats": [
                {"comparator": ">", "value": 10, "palette": "white_on_yellow"},
                {"comparator": "<=", "value": 10, "palette": "white_on_green"}
            ]}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "Cron Jobs Active",
            "type": "query_value",
            "requests": [{"q": "sum:openclaw.cron.jobs_active{*}", "aggregator": "last"}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "Poll Jobs Active",
            "type": "query_value",
            "requests": [{"q": "sum:openclaw.poll.jobs_active{*}", "aggregator": "last"}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "Nudges from Jobs",
            "type": "timeseries",
            "requests": [
                {"q": "sum:openclaw.cron.nudges_sent{*}.as_count()", "display_type": "bars", "style": {"palette": "blue"}},
                {"q": "sum:openclaw.poll.nudges_sent{*}.as_count()", "display_type": "bars", "style": {"palette": "orange"}}
            ]
        }
    })

    # ============================================================
    # BEAD LIFECYCLE FUNNEL
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 📿 Bead Lifecycle Flow\n**Created → Hooked → Assigned → Working → Completed**",
            "background_color": "vivid_purple",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    # Funnel-style visualization using stacked bars
    widgets.append({
        "definition": {
            "title": "Bead Pipeline Stages",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.bead.stage.created{*}.as_count()", "display_type": "bars", "style": {"palette": "cool"}},
                {"q": "sum:gastown.bead.stage.hooked{*}.as_count()", "display_type": "bars", "style": {"palette": "cool"}},
                {"q": "sum:gastown.bead.stage.assigned{*}.as_count()", "display_type": "bars", "style": {"palette": "cool"}},
                {"q": "sum:gastown.bead.stage.working{*}.as_count()", "display_type": "bars", "style": {"palette": "cool"}},
                {"q": "sum:gastown.bead.stage.completed{*}.as_count()", "display_type": "bars", "style": {"palette": "cool"}}
            ],
            "show_legend": True
        }
    })

    widgets.append({
        "definition": {
            "title": "Bead Duration Heatmap",
            "type": "heatmap",
            "requests": [
                {"q": "avg:gastown.bead.lifecycle.duration_s{*} by {rig}"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Hook → Assignment Latency",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.bead.hook_to_assign_ms{*}", "display_type": "line"},
                {"q": "p95:gastown.bead.hook_to_assign_ms{*}", "display_type": "line"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Bead Outcomes Distribution",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:gastown.bead.lifecycle.count{*} by {outcome}.as_count(), 10, 'sum', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Escalated Beads (Andon)",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.beads.escalated{*}.as_count()", "conditional_formats": [
                {"comparator": ">", "value": 5, "palette": "white_on_red"},
                {"comparator": ">", "value": 0, "palette": "white_on_yellow"},
                {"comparator": "<=", "value": 0, "palette": "white_on_green"}
            ]}],
            "precision": 0
        }
    })

    # ============================================================
    # POLECAT OPERATIONS
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🦨 Polecat Operations\n**Spawn → Work → Nudge → Complete**",
            "background_color": "vivid_yellow",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Polecat Lifecycle",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.polecats.spawned{*}.as_count()", "display_type": "bars", "style": {"palette": "green"}},
                {"q": "sum:gastown.polecats.completed{*}.as_count()", "display_type": "bars", "style": {"palette": "blue"}},
                {"q": "sum:gastown.polecats.failed{*}.as_count()", "display_type": "bars", "style": {"palette": "red"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Active by Rig",
            "type": "toplist",
            "requests": [
                {"q": "top(avg:gastown.polecats.active{*} by {rig_name}, 10, 'mean', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Work Duration Distribution",
            "type": "heatmap",
            "requests": [
                {"q": "avg:gastown.polecat.duration_s{*} by {rig_name}"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Token Burn Rate",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.polecat.tokens_used{*} by {rig_name}.as_count()", "display_type": "area"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Context Window Usage %",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.polecat.context_pct{*} by {rig_name}", "display_type": "line"}
            ],
            "yaxis": {"max": "100"},
            "markers": [{"value": "y = 80", "display_type": "warning dashed", "label": "Warning"}]
        }
    })

    widgets.append({
        "definition": {
            "title": "PRs Created",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.polecat.prs_created{*}.as_count()"}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "Code Output",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.polecat.lines_added{*}.as_count()", "display_type": "area", "style": {"palette": "green"}},
                {"q": "sum:gastown.polecat.lines_deleted{*}.as_count()", "display_type": "area", "style": {"palette": "red"}}
            ]
        }
    })

    # ============================================================
    # GITHUB INTEGRATION
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🐙 GitHub Integration\n**PRs | Issues | Commits | Actions**",
            "background_color": "gray",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "PRs Opened Today",
            "type": "query_value",
            "requests": [{"q": "sum:github.prs.opened{*}.as_count()"}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "PRs Merged",
            "type": "query_value",
            "requests": [{"q": "sum:github.prs.merged{*}.as_count()"}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "Open Issues",
            "type": "query_value",
            "requests": [{"q": "sum:github.issues.open{*}", "aggregator": "last"}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "PR Activity by Repo",
            "type": "timeseries",
            "requests": [
                {"q": "sum:github.prs.activity{*} by {repo}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "CI/CD Pass Rate",
            "type": "query_value",
            "requests": [{"q": "100 * sum:github.actions.success{*}.as_count() / (sum:github.actions.total{*}.as_count() + 1)", "conditional_formats": [
                {"comparator": ">=", "value": 95, "palette": "white_on_green"},
                {"comparator": ">=", "value": 80, "palette": "white_on_yellow"},
                {"comparator": "<", "value": 80, "palette": "white_on_red"}
            ]}],
            "precision": 1,
            "custom_unit": "%"
        }
    })

    widgets.append({
        "definition": {
            "title": "Commits by Author",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:github.commits{*} by {author}.as_count(), 10, 'sum', 'desc')"}
            ]
        }
    })

    # ============================================================
    # MCP SERVERS
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🔌 MCP Servers\n**Sequential Thinking | Desktop Commander | Filesystem**",
            "background_color": "vivid_blue",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "MCP Requests by Server",
            "type": "timeseries",
            "requests": [
                {"q": "sum:mcp.request.count{*} by {server}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "MCP Latency (p95)",
            "type": "timeseries",
            "requests": [
                {"q": "p95:mcp.request.duration_ms{*} by {server}", "display_type": "line"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "MCP Errors",
            "type": "query_value",
            "requests": [{"q": "sum:mcp.errors{*}.as_count()", "conditional_formats": [
                {"comparator": ">", "value": 0, "palette": "white_on_red"},
                {"comparator": "<=", "value": 0, "palette": "white_on_green"}
            ]}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "Sequential Thinking Depth",
            "type": "heatmap",
            "requests": [
                {"q": "avg:mcp.sequential_thinking.thought_count{*} by {problem_type}"}
            ]
        }
    })

    # ============================================================
    # CLAUDE CODE / ANTHROPIC
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 💜 Claude Code / Anthropic\n**Opus 4.5 | Sonnet 4 | Haiku 3.5**",
            "background_color": "vivid_orange",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Requests by Model",
            "type": "timeseries",
            "requests": [
                {"q": "sum:claude.api.request.count{*} by {model}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Token Flow",
            "type": "timeseries",
            "requests": [
                {"q": "sum:claude.api.tokens.input{*}.as_count()", "display_type": "area", "style": {"palette": "blue"}},
                {"q": "sum:claude.api.tokens.output{*}.as_count()", "display_type": "area", "style": {"palette": "purple"}},
                {"q": "sum:claude.api.tokens.cache_read{*}.as_count()", "display_type": "area", "style": {"palette": "green"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Cache Hit Rate",
            "type": "query_value",
            "requests": [{"q": "100 * sum:claude.api.tokens.cache_read{*}.as_count() / (sum:claude.api.tokens.input{*}.as_count() + 1)", "conditional_formats": [
                {"comparator": ">=", "value": 50, "palette": "white_on_green"},
                {"comparator": ">=", "value": 20, "palette": "white_on_yellow"},
                {"comparator": "<", "value": 20, "palette": "white_on_red"}
            ]}],
            "precision": 1,
            "custom_unit": "%"
        }
    })

    widgets.append({
        "definition": {
            "title": "Latency by Model",
            "type": "heatmap",
            "requests": [
                {"q": "avg:claude.api.request.duration_ms{*} by {model}"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Tool Usage",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:claude.tool_use.count{*} by {tool_name}.as_count(), 10, 'sum', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Thinking Time",
            "type": "timeseries",
            "requests": [
                {"q": "avg:claude.thinking.duration_ms{*} by {model}", "display_type": "line"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Extended Thinking Usage",
            "type": "query_value",
            "requests": [{"q": "sum:claude.extended_thinking.enabled{*}.as_count()"}],
            "precision": 0
        }
    })

    # ============================================================
    # OPENAI / CODEX
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🟢 OpenAI / Codex\n**GPT-4o | o1 | o1-pro | Embeddings**",
            "background_color": "white",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Requests by Model",
            "type": "timeseries",
            "requests": [
                {"q": "sum:openai.api.request.count{*} by {model}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Token Usage",
            "type": "timeseries",
            "requests": [
                {"q": "sum:openai.api.tokens.input{*}.as_count()", "display_type": "area"},
                {"q": "sum:openai.api.tokens.output{*}.as_count()", "display_type": "area"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Reasoning Tokens (o1)",
            "type": "timeseries",
            "requests": [
                {"q": "sum:openai.o1.reasoning_tokens{*}.as_count()", "display_type": "area", "style": {"palette": "warm"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Embeddings Generated",
            "type": "query_value",
            "requests": [{"q": "sum:openai.embedding.count{*}.as_count()"}],
            "precision": 0
        }
    })

    # ============================================================
    # RALPH WIGGUM LOOP
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🧠 Ralph Wiggum Loop\n**Iterative Problem Solving with Convergence**",
            "background_color": "vivid_blue",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Loop Iterations",
            "type": "timeseries",
            "requests": [
                {"q": "sum:ralph.loop.iteration{outcome:success}.as_count()", "display_type": "bars", "style": {"palette": "green"}},
                {"q": "sum:ralph.loop.iteration{outcome:failure}.as_count()", "display_type": "bars", "style": {"palette": "red"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Convergence Rate",
            "type": "query_value",
            "requests": [{"q": "100 * sum:ralph.loop.converged{*}.as_count() / (sum:ralph.loop.started{*}.as_count() + 1)", "conditional_formats": [
                {"comparator": ">=", "value": 80, "palette": "white_on_green"},
                {"comparator": ">=", "value": 50, "palette": "white_on_yellow"},
                {"comparator": "<", "value": 50, "palette": "white_on_red"}
            ]}],
            "precision": 1,
            "custom_unit": "%"
        }
    })

    widgets.append({
        "definition": {
            "title": "Thoughts to Convergence",
            "type": "heatmap",
            "requests": [
                {"q": "avg:ralph.thinking.thought_count{*} by {problem_type}"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Convergence Time (p95)",
            "type": "query_value",
            "requests": [{"q": "p95:ralph.thinking.convergence_ms{*}"}],
            "precision": 0,
            "custom_unit": "ms"
        }
    })

    widgets.append({
        "definition": {
            "title": "Revision Rate",
            "type": "timeseries",
            "requests": [
                {"q": "sum:ralph.thinking.revisions{*}.as_count()", "display_type": "line"}
            ]
        }
    })

    # ============================================================
    # NUDGES & COMMUNICATION
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 📬 Nudges & Mail\n**Agent-to-Agent Communication**",
            "background_color": "vivid_orange",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Nudge Traffic",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.nudges.sent{*} by {target_agent}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Response Rate",
            "type": "query_value",
            "requests": [{"q": "100 * sum:gastown.nudges.responded{*}.as_count() / (sum:gastown.nudges.sent{*}.as_count() + 1)", "conditional_formats": [
                {"comparator": ">=", "value": 90, "palette": "white_on_green"},
                {"comparator": ">=", "value": 70, "palette": "white_on_yellow"},
                {"comparator": "<", "value": 70, "palette": "white_on_red"}
            ]}],
            "precision": 1,
            "custom_unit": "%"
        }
    })

    widgets.append({
        "definition": {
            "title": "Mail Queue",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.mail.sent.count{*}.as_count()", "display_type": "line", "style": {"palette": "blue"}},
                {"q": "sum:gastown.mail.read.count{*}.as_count()", "display_type": "line", "style": {"palette": "green"}}
            ]
        }
    })

    # ============================================================
    # MAYOR & CREW
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 👔 Mayor & Crew\n**Task Assignment & Orchestration**",
            "background_color": "vivid_blue",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Tasks by Priority",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.mayor.tasks_assigned{priority:high}.as_count()", "display_type": "bars", "style": {"palette": "red"}},
                {"q": "sum:gastown.mayor.tasks_assigned{priority:medium}.as_count()", "display_type": "bars", "style": {"palette": "yellow"}},
                {"q": "sum:gastown.mayor.tasks_assigned{priority:low}.as_count()", "display_type": "bars", "style": {"palette": "green"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Task Types",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:gastown.mayor.tasks_assigned{*} by {task_type}.as_count(), 10, 'sum', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Crew Utilization",
            "type": "heatmap",
            "requests": [
                {"q": "avg:gastown.crew.utilization_pct{*} by {crew_member}"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Task Acceptance Rate",
            "type": "query_value",
            "requests": [{"q": "100 * sum:gastown.task.accepted{*}.as_count() / (sum:gastown.task.assigned{*}.as_count() + 1)", "conditional_formats": [
                {"comparator": ">=", "value": 90, "palette": "white_on_green"},
                {"comparator": ">=", "value": 70, "palette": "white_on_yellow"},
                {"comparator": "<", "value": 70, "palette": "white_on_red"}
            ]}],
            "precision": 1,
            "custom_unit": "%"
        }
    })

    # ============================================================
    # WITNESS / DEACON / REFINERY
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🔮 Witness / Deacon / Refinery\n**Lifecycle | Health | Merges**",
            "background_color": "vivid_pink",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Witness Events",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.witness.lifecycle_events{*} by {event_type}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Deacon Health Checks",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.deacon.health_checks{result:healthy}.as_count()", "display_type": "bars", "style": {"palette": "green"}},
                {"q": "sum:gastown.deacon.health_checks{result:unhealthy}.as_count()", "display_type": "bars", "style": {"palette": "red"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Merge Pipeline",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.refinery.merges_processed{outcome:merged}.as_count()", "display_type": "bars", "style": {"palette": "green"}},
                {"q": "sum:gastown.refinery.merges_processed{outcome:conflict}.as_count()", "display_type": "bars", "style": {"palette": "yellow"}},
                {"q": "sum:gastown.refinery.merges_processed{outcome:rejected}.as_count()", "display_type": "bars", "style": {"palette": "red"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Merge Success Rate",
            "type": "query_value",
            "requests": [{"q": "100 * sum:gastown.refinery.merges_processed{outcome:merged}.as_count() / (sum:gastown.refinery.merges_processed{*}.as_count() + 1)", "conditional_formats": [
                {"comparator": ">=", "value": 90, "palette": "white_on_green"},
                {"comparator": ">=", "value": 70, "palette": "white_on_yellow"},
                {"comparator": "<", "value": 70, "palette": "white_on_red"}
            ]}],
            "precision": 1,
            "custom_unit": "%"
        }
    })

    # ============================================================
    # CONVOY & MOLECULES
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🚚 Convoy & Molecules\n**Batch Work + Formula Templates**",
            "background_color": "vivid_purple",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Convoy Progress",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.convoy.started{*}.as_count()", "display_type": "bars", "style": {"palette": "blue"}},
                {"q": "sum:gastown.convoy.completed{*}.as_count()", "display_type": "bars", "style": {"palette": "green"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Molecule Completion %",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.molecule.progress_pct{*} by {formula_template}", "display_type": "line"}
            ],
            "yaxis": {"max": "100"}
        }
    })

    widgets.append({
        "definition": {
            "title": "Blocked Items",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.convoy.blocked{*}", "aggregator": "last", "conditional_formats": [
                {"comparator": ">", "value": 0, "palette": "white_on_yellow"},
                {"comparator": "<=", "value": 0, "palette": "white_on_green"}
            ]}],
            "precision": 0
        }
    })

    # ============================================================
    # COST & EFFICIENCY ANALYSIS
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 💰 Cost & Efficiency\n**Spend Tracking | ROI | Optimization**",
            "background_color": "white",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Cost by Provider",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:ai_agent.cost.total_usd{*} by {provider}.as_count(), 10, 'sum', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Cost Trend",
            "type": "timeseries",
            "requests": [
                {"q": "cumsum(sum:ai_agent.cost.total_usd{*}.as_count()) / 1000000", "display_type": "area"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Cost per Task",
            "type": "query_value",
            "requests": [{"q": "(sum:ai_agent.cost.total_usd{*}.as_count() / 1000000) / (sum:gastown.bead.lifecycle.count{*}.as_count() + 1)"}],
            "precision": 3,
            "custom_unit": "$"
        }
    })

    widgets.append({
        "definition": {
            "title": "Token Efficiency (Out/In Ratio)",
            "type": "query_value",
            "requests": [{"q": "sum:ai_agent.tokens.total{direction:output}.as_count() / (sum:ai_agent.tokens.total{direction:input}.as_count() + 1)"}],
            "precision": 2,
            "custom_unit": ":1"
        }
    })

    widgets.append({
        "definition": {
            "title": "Tasks per Dollar",
            "type": "query_value",
            "requests": [{"q": "(sum:gastown.bead.lifecycle.count{outcome:success}.as_count()) / ((sum:ai_agent.cost.total_usd{*}.as_count() / 1000000) + 0.01)"}],
            "precision": 1
        }
    })

    # ============================================================
    # AGENT STATES & RESOURCES
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🤖 Agent States\n**Working | Idle | Stuck**",
            "background_color": "vivid_green",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Agent State Distribution",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:gastown.agent.state{*} by {state}, 10, 'sum', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "tmux Sessions",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.tmux.total_sessions{*}", "aggregator": "last"}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "PTY Sessions",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.pty.sessions_active{*}", "aggregator": "last"}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "Oldest tmux (hours)",
            "type": "query_value",
            "requests": [{"q": "max:gastown.tmux.oldest_hours{*}", "aggregator": "last"}],
            "precision": 1,
            "custom_unit": "h"
        }
    })

    widgets.append({
        "definition": {
            "title": "Oldest PTY (hours)",
            "type": "query_value",
            "requests": [{"q": "max:gastown.pty.oldest_hours{*}", "aggregator": "last"}],
            "precision": 1,
            "custom_unit": "h"
        }
    })

    widgets.append({
        "definition": {
            "title": "Terminal Sessions Over Time",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.tmux.total_sessions{*}", "display_type": "line"},
                {"q": "avg:gastown.pty.sessions_active{*}", "display_type": "line"}
            ]
        }
    })

    # ============================================================
    # CREW + GPU/MEMORY
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 👥 Crew + Resources\n**Utilization | Memory | Tokens**",
            "background_color": "vivid_purple",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Active Crew by Type",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:gastown.crew.active{*} by {crew_type}, 10, 'mean', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Crew Memory Usage (GB)",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.crew.memory_gb{*} by {crew_type}", "display_type": "area"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Tokens by Crew Type",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.crew.tokens_used{*} by {crew_type}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "System Memory %",
            "type": "query_value",
            "requests": [{"q": "avg:gastown.memory.used_pct{*}", "aggregator": "last", "conditional_formats": [
                {"comparator": ">=", "value": 90, "palette": "white_on_red"},
                {"comparator": ">=", "value": 70, "palette": "white_on_yellow"},
                {"comparator": "<", "value": 70, "palette": "white_on_green"}
            ]}],
            "precision": 1,
            "custom_unit": "%"
        }
    })

    # ============================================================
    # TOKENS BY PROVIDER
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🎫 Tokens by Provider\n**Anthropic | OpenAI | Ollama**",
            "background_color": "vivid_orange",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Total Tokens by Provider",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:tokens.total{*} by {provider}.as_count(), 10, 'sum', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Input vs Output Tokens",
            "type": "timeseries",
            "requests": [
                {"q": "sum:tokens.input{*} by {provider}.as_count()", "display_type": "bars"},
                {"q": "sum:tokens.output{*} by {provider}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Anthropic Tokens",
            "type": "query_value",
            "requests": [{"q": "sum:tokens.total{provider:anthropic}.as_count()"}],
            "precision": 0,
            "autoscale": True
        }
    })

    widgets.append({
        "definition": {
            "title": "OpenAI Tokens",
            "type": "query_value",
            "requests": [{"q": "sum:tokens.total{provider:openai}.as_count()"}],
            "precision": 0,
            "autoscale": True
        }
    })

    widgets.append({
        "definition": {
            "title": "Ollama Tokens (Local)",
            "type": "query_value",
            "requests": [{"q": "sum:tokens.total{provider:ollama}.as_count()"}],
            "precision": 0,
            "autoscale": True
        }
    })

    widgets.append({
        "definition": {
            "title": "Idle Time by Agent",
            "type": "heatmap",
            "requests": [
                {"q": "avg:gastown.agent.idle_duration_s{*} by {agent_id}"}
            ]
        }
    })

    # ============================================================
    # LOGS & OBSERVABILITY
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 📋 Logs & Observability\n**Structured Logging | Errors | Traces**",
            "background_color": "gray",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Log Volume",
            "type": "timeseries",
            "requests": [
                {"q": "sum:logs.count{*} by {service}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Error Logs",
            "type": "timeseries",
            "requests": [
                {"q": "sum:logs.error{*} by {service}.as_count()", "display_type": "bars", "style": {"palette": "warm"}}
            ]
        }
    })

    # ============================================================
    # PROFILING & RESOURCES
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# ⚙️ System Resources\n**CPU | Memory | Profiling**",
            "background_color": "vivid_pink",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "CPU by Service",
            "type": "timeseries",
            "requests": [
                {"q": "avg:system.cpu.user{*} by {service}", "display_type": "line"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Memory Usage",
            "type": "timeseries",
            "requests": [
                {"q": "avg:system.mem.used{*} by {service}", "display_type": "area"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Process Count",
            "type": "query_value",
            "requests": [{"q": "sum:system.processes.number{*}"}],
            "precision": 0
        }
    })

    # ============================================================
    # DEM / RUM
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🌐 Digital Experience\n**Core Web Vitals | Sessions | Errors**",
            "background_color": "vivid_green",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "LCP (Largest Contentful Paint)",
            "type": "query_value",
            "requests": [{"q": "avg:rum.largest_contentful_paint{*}", "conditional_formats": [
                {"comparator": "<=", "value": 2500, "palette": "white_on_green"},
                {"comparator": "<=", "value": 4000, "palette": "white_on_yellow"},
                {"comparator": ">", "value": 4000, "palette": "white_on_red"}
            ]}],
            "precision": 0,
            "custom_unit": "ms"
        }
    })

    widgets.append({
        "definition": {
            "title": "Page Load Time",
            "type": "timeseries",
            "requests": [
                {"q": "avg:rum.performance.dom_complete{*}", "display_type": "line"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "JS Errors",
            "type": "timeseries",
            "requests": [
                {"q": "sum:rum.error.count{*} by {error.source}.as_count()", "display_type": "bars", "style": {"palette": "warm"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Active Sessions",
            "type": "query_value",
            "requests": [{"q": "sum:rum.session.count{*}.as_count()"}],
            "precision": 0
        }
    })

    return widgets


dashboard = {
    "title": "⛽ Gas Town Unified Ops - Complete Observability",
    "description": "Multi-Agent Orchestration | OpenClaw Gateway | Claude Code | Ralph Loop | GitHub | MCP | APM | Logs | Profiling | DEM",
    "widgets": create_widgets(),
    "template_variables": [
        {"name": "env", "default": "*", "prefix": "env", "available_values": ["prod", "staging", "dev", "studio", "local"]},
        {"name": "service", "default": "*", "prefix": "service", "available_values": ["gastown-sensei", "openclaw", "gastown", "ralph-loop", "claude-code", "sequential-thinking"]},
        {"name": "rig", "default": "*", "prefix": "rig_name"},
        {"name": "provider", "default": "*", "prefix": "provider", "available_values": ["anthropic", "openai", "ollama"]},
        {"name": "model", "default": "*", "prefix": "model"},
        {"name": "host", "default": "*", "prefix": "host"},
        {"name": "agent", "default": "*", "prefix": "agent_id"},
        {"name": "outcome", "default": "*", "prefix": "outcome"}
    ],
    "layout_type": "ordered",
    "notify_list": [],
    "reflow_type": "auto"
}

def update_dashboard(dashboard_id: str, create: bool, site: str) -> bool:
    api_base = f"https://api.{site}"
    if create or not dashboard_id:
        url = f"{api_base}/api/v1/dashboard"
        method = "POST"
    else:
        url = f"{api_base}/api/v1/dashboard/{dashboard_id}"
        method = "PUT"

    headers = {
        "DD-API-KEY": DD_API_KEY or "",
        "DD-APPLICATION-KEY": DD_APP_KEY or "",
        "Content-Type": "application/json",
    }

    data = json.dumps(dashboard).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            result_id = result.get("id", dashboard_id)
            print("Dashboard updated successfully!")
            print(f"Title: {result.get('title')}")
            if result_id:
                print(f"URL: https://app.{site}/dashboard/{result_id}")
            print(f"Widgets: {len(result.get('widgets', []))}")
            return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"Error updating dashboard: {e.code}")
        print(f"Response: {error_body}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Update Gas Town Unified Ops dashboard")
    parser.add_argument("--dashboard-id", default=DASHBOARD_ID, help="Existing dashboard ID to update")
    parser.add_argument("--create", action="store_true", help="Create a new dashboard instead of updating")
    parser.add_argument("--site", default=DD_SITE, help="Datadog site (default: DD_SITE or datadoghq.com)")
    args = parser.parse_args()

    if not DD_API_KEY or not DD_APP_KEY:
        print("DD_API_KEY and DD_APP_KEY are required (or DATADOG_* equivalents).")
        return 1

    ok = update_dashboard(args.dashboard_id, args.create, args.site)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
