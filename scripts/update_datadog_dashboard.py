#!/usr/bin/env python3
"""Update Datadog dashboard with comprehensive Gas Town metrics - flat widget layout"""

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
    """Build flat widget list for dashboard - no groups, just widgets with note headers"""
    widgets = []

    # ============================================================
    # HEADER: SYSTEM HEALTH
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# ⛽ GAS TOWN - System Health\n*Multi-Agent Orchestration Platform*",
            "background_color": "green",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Town Health",
            "type": "query_value",
            "requests": [{"q": "avg:gastown.town.health{*}", "aggregator": "last", "conditional_formats": [
                {"comparator": ">=", "value": 80, "palette": "white_on_green"},
                {"comparator": ">=", "value": 50, "palette": "white_on_yellow"},
                {"comparator": "<", "value": 50, "palette": "white_on_red"}
            ]}],
            "precision": 0,
            "custom_unit": "/100"
        }
    })

    widgets.append({
        "definition": {
            "title": "Active Polecats",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.polecats.active{*}", "aggregator": "last"}],
            "precision": 0,
            "autoscale": True
        }
    })

    widgets.append({
        "definition": {
            "title": "Requests/min",
            "type": "query_value",
            "requests": [{"q": "sum:trace.http.request.hits{service:gastown-sensei OR service:openclaw}.as_rate()"}],
            "autoscale": True,
            "custom_unit": "/min"
        }
    })

    widgets.append({
        "definition": {
            "title": "Error Rate",
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

    widgets.append({
        "definition": {
            "title": "Total Cost (24h)",
            "type": "query_value",
            "requests": [{"q": "sum:ai_agent.cost.total_usd{*}.as_count() / 1000000"}],
            "precision": 2,
            "custom_unit": "$"
        }
    })

    widgets.append({
        "definition": {
            "title": "Stuck Agents",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.agent.stuck_count{*}.as_count()", "conditional_formats": [
                {"comparator": ">", "value": 0, "palette": "white_on_red"},
                {"comparator": "<=", "value": 0, "palette": "white_on_green"}
            ]}],
            "precision": 0
        }
    })

    # ============================================================
    # HEADER: APM - TRACES & LATENCY
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 📊 APM - Traces & Latency\n*Distributed Tracing for All Services*",
            "background_color": "blue",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Service Latency (p95)",
            "type": "timeseries",
            "requests": [
                {"q": "p95:trace.http.request.duration{service:gastown-sensei}", "display_type": "line"},
                {"q": "p95:trace.http.request.duration{service:openclaw}", "display_type": "line"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Trace Throughput by Service",
            "type": "timeseries",
            "requests": [
                {"q": "sum:trace.http.request.hits{*} by {service}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Slowest Endpoints",
            "type": "toplist",
            "requests": [
                {"q": "top(p99:trace.http.request.duration{*} by {resource_name}, 10, 'mean', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Error Rate by Service",
            "type": "timeseries",
            "requests": [
                {"q": "100 * sum:trace.http.request.errors{*} by {service}.as_count() / (sum:trace.http.request.hits{*} by {service}.as_count() + 1)"}
            ],
            "markers": [{"value": "y = 5", "display_type": "error dashed"}]
        }
    })

    # ============================================================
    # HEADER: BEAD LIFECYCLE TRACING
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 📿 Bead Lifecycle Tracing\n*Task Units → Hooks → Crews → Polecats → Nudges*",
            "background_color": "purple",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Bead Lifecycle Duration",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.bead.lifecycle.duration_s{*} by {rig}", "display_type": "line"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Bead Hooks by Agent",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.bead.hook.count{*} by {agent}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Crew Assignments",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.crew.assign.count{*} by {target}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Bead Outcomes",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:gastown.bead.lifecycle.count{*} by {outcome}.as_count(), 10, 'sum', 'desc')"}
            ]
        }
    })

    # ============================================================
    # HEADER: POLECAT OPERATIONS
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🦨 Polecat Operations\n*Autonomous Agent Workers*",
            "background_color": "yellow",
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
            "title": "Token Usage by Rig",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.polecat.tokens_used{*} by {rig_name}.as_count()"}
            ]
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
            "title": "Lines Changed",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.polecat.lines_added{*}.as_count()", "display_type": "area", "style": {"palette": "green"}},
                {"q": "sum:gastown.polecat.lines_deleted{*}.as_count()", "display_type": "area", "style": {"palette": "red"}}
            ]
        }
    })

    # ============================================================
    # HEADER: NUDGES & MAIL
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 📬 Nudges & Mail\n*Agent-to-Agent Communication*",
            "background_color": "orange",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Nudges Sent",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.nudges.sent{*} by {target_agent}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Nudge Response Time",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.nudge.duration_ms{*}", "display_type": "line"},
                {"q": "p95:gastown.nudge.duration_ms{*}", "display_type": "line"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Mail Sent/Read",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.mail.sent.count{*}.as_count()", "display_type": "bars", "style": {"palette": "blue"}},
                {"q": "sum:gastown.mail.read.count{*}.as_count()", "display_type": "bars", "style": {"palette": "green"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Nudges Responded",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.nudges.responded{*}.as_count()"}],
            "precision": 0
        }
    })

    # ============================================================
    # HEADER: MAYOR & CREW
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 👔 Mayor & Crew\n*Task Assignment & Team Coordination*",
            "background_color": "blue",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Mayor Tasks Assigned",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.mayor.tasks_assigned{*} by {priority}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Tasks by Type",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:gastown.mayor.tasks_assigned{*} by {task_type}.as_count(), 10, 'sum', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Active Crew",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.crew.active{*}", "aggregator": "last"}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "Crew Contributions",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:gastown.crew.contributions{*} by {crew_member}.as_count(), 10, 'sum', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Task Acceptance Rate",
            "type": "query_value",
            "requests": [{"q": "100 * sum:gastown.task.accepted{*}.as_count() / (sum:gastown.task.assigned{*}.as_count() + 1)"}],
            "precision": 1,
            "custom_unit": "%"
        }
    })

    # ============================================================
    # HEADER: WITNESS / DEACON / REFINERY
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🔮 Witness / Deacon / Refinery\n*Lifecycle Monitoring + Health Checks + Merge Integration*",
            "background_color": "pink",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Witness Lifecycle Events",
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
                {"q": "sum:gastown.deacon.health_checks{*} by {result}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Active Dogs",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.deacon.dogs_active{*}", "aggregator": "last"}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "Merge Queue Depth",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.refinery.merges_queued{*} by {rig_name}"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Merge Outcomes",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.refinery.merges_processed{outcome:merged}.as_count()", "display_type": "bars", "style": {"palette": "green"}},
                {"q": "sum:gastown.refinery.merges_processed{outcome:rejected}.as_count()", "display_type": "bars", "style": {"palette": "red"}},
                {"q": "sum:gastown.refinery.merges_processed{outcome:conflict}.as_count()", "display_type": "bars", "style": {"palette": "yellow"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Integration Time",
            "type": "query_value",
            "requests": [{"q": "avg:gastown.refinery.integration_time_s{*}"}],
            "precision": 1,
            "custom_unit": "s"
        }
    })

    # ============================================================
    # HEADER: BEADS & KANBAN
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 📿 Beads & Kanban\n*Task Units + WIP Limits + Andon Escalation*",
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
            "title": "Beads Created by Priority",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.beads.created{*} by {priority}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Beads In Progress",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.beads.in_progress{*}", "aggregator": "last"}],
            "precision": 0
        }
    })

    widgets.append({
        "definition": {
            "title": "Beads Escalated (Andon)",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.beads.escalated{*} by {reason}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Kanban Columns",
            "type": "toplist",
            "requests": [
                {"q": "top(avg:gastown.kanban.column_count{*} by {column}, 10, 'mean', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "WIP Violations",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.kanban.wip_limit_violations{*}.as_count()", "conditional_formats": [
                {"comparator": ">", "value": 0, "palette": "white_on_red"},
                {"comparator": "<=", "value": 0, "palette": "white_on_green"}
            ]}],
            "precision": 0
        }
    })

    # ============================================================
    # HEADER: CONVOY & MOLECULES
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🚚 Convoy & Molecules\n*Work Batches + Formula Templates*",
            "background_color": "purple",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Convoy Status",
            "type": "timeseries",
            "requests": [
                {"q": "sum:gastown.convoy.started{*}.as_count()", "display_type": "bars", "style": {"palette": "blue"}},
                {"q": "sum:gastown.convoy.completed{success:true}.as_count()", "display_type": "bars", "style": {"palette": "green"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Convoy by Priority",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:gastown.convoy.priority_distribution{*} by {priority}.as_count(), 10, 'sum', 'desc')"}
            ]
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

    widgets.append({
        "definition": {
            "title": "Molecule Progress",
            "type": "timeseries",
            "requests": [
                {"q": "avg:gastown.molecule.progress_pct{*} by {formula_template}"}
            ],
            "yaxis": {"max": "100"}
        }
    })

    widgets.append({
        "definition": {
            "title": "Molecules Started",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.molecule.started{*}.as_count()"}],
            "precision": 0
        }
    })

    # ============================================================
    # HEADER: AGENT STATES
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🤖 Agent States\n*Working / Idle / Stuck + tmux Sessions*",
            "background_color": "green",
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
            "title": "Idle Duration by Agent",
            "type": "toplist",
            "requests": [
                {"q": "top(avg:gastown.agent.idle_duration_s{*} by {agent_id}, 10, 'mean', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Agents per Rig",
            "type": "toplist",
            "requests": [
                {"q": "top(avg:gastown.rig.agents_count{*} by {rig_name}, 10, 'mean', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "tmux Sessions",
            "type": "query_value",
            "requests": [{"q": "sum:gastown.tmux.sessions_active{*}", "aggregator": "last"}],
            "precision": 0
        }
    })

    # ============================================================
    # HEADER: CLAUDE CODE / ANTHROPIC
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 💜 Claude Code / Anthropic API\n*Claude Opus 4.5, Sonnet, Haiku - AI Coding Agents*",
            "background_color": "orange",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Claude Requests by Model",
            "type": "timeseries",
            "requests": [
                {"q": "sum:claude.api.request.count{*} by {model}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Token Usage (Input/Output)",
            "type": "timeseries",
            "requests": [
                {"q": "sum:claude.api.tokens.input{*}.as_count()", "display_type": "area", "style": {"palette": "blue"}},
                {"q": "sum:claude.api.tokens.output{*}.as_count()", "display_type": "area", "style": {"palette": "orange"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Claude Latency",
            "type": "timeseries",
            "requests": [
                {"q": "p50:claude.api.request.duration_ms{*}", "display_type": "line"},
                {"q": "p95:claude.api.request.duration_ms{*}", "display_type": "line"},
                {"q": "p99:claude.api.request.duration_ms{*}", "display_type": "line"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Cost by Model",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:claude.api.cost_usd{*} by {model}.as_count(), 10, 'sum', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Cache Hit Rate",
            "type": "query_value",
            "requests": [{"q": "100 * sum:claude.api.tokens.cache_read{*}.as_count() / (sum:claude.api.tokens.input{*}.as_count() + 1)"}],
            "precision": 1,
            "custom_unit": "%"
        }
    })

    widgets.append({
        "definition": {
            "title": "Tool Calls",
            "type": "toplist",
            "requests": [
                {"q": "top(sum:claude.tool_use.count{*} by {tool_name}.as_count(), 10, 'sum', 'desc')"}
            ]
        }
    })

    # ============================================================
    # HEADER: OPENAI / CODEX
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🟢 OpenAI / Codex\n*GPT-4o, o1, o1-pro, Codex - AI Models*",
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
            "title": "OpenAI Requests",
            "type": "timeseries",
            "requests": [
                {"q": "sum:openai.api.request.count{*} by {model}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "OpenAI Tokens",
            "type": "timeseries",
            "requests": [
                {"q": "sum:openai.api.tokens.input{*}.as_count()", "display_type": "area"},
                {"q": "sum:openai.api.tokens.output{*}.as_count()", "display_type": "area"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "OpenAI Latency",
            "type": "timeseries",
            "requests": [
                {"q": "avg:openai.api.request.duration_ms{*} by {model}"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Embeddings",
            "type": "query_value",
            "requests": [{"q": "sum:openai.embedding.count{*}.as_count()"}],
            "precision": 0
        }
    })

    # ============================================================
    # HEADER: RALPH LOOP / SEQUENTIAL THINKING
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🧠 Ralph Wiggum Loop\n*Sequential Thinking MCP + Iterative Problem Solving*",
            "background_color": "blue",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
        }
    })

    widgets.append({
        "definition": {
            "title": "Ralph Iterations",
            "type": "timeseries",
            "requests": [
                {"q": "sum:ralph.loop.iteration{outcome:success}.as_count()", "display_type": "bars", "style": {"palette": "green"}},
                {"q": "sum:ralph.loop.iteration{outcome:failure}.as_count()", "display_type": "bars", "style": {"palette": "red"}}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Thoughts per Problem",
            "type": "toplist",
            "requests": [
                {"q": "top(avg:ralph.thinking.thought_count{*} by {problem_id}, 10, 'mean', 'desc')"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Convergence Time (p95)",
            "type": "query_value",
            "requests": [{"q": "p95:ralph.thinking.convergence_ms{*}"}],
            "custom_unit": "ms"
        }
    })

    widgets.append({
        "definition": {
            "title": "Sequential Thinking Latency",
            "type": "timeseries",
            "requests": [
                {"q": "avg:sequential_thinking.request.duration_ms{*} by {model}"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Fallbacks",
            "type": "timeseries",
            "requests": [
                {"q": "sum:sequential_thinking.fallback.count{*} by {reason}.as_count()", "display_type": "bars"}
            ]
        }
    })

    # ============================================================
    # HEADER: LOGS
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 📋 Logs\n*Structured Logging by Service*",
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
            "title": "Log Volume by Service",
            "type": "timeseries",
            "requests": [
                {"q": "sum:logs.count{service:gastown-sensei OR service:openclaw OR service:gastown} by {service}.as_count()"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Log Errors by Service",
            "type": "timeseries",
            "requests": [
                {"q": "sum:logs.error{*} by {service}.as_count()", "display_type": "bars"}
            ]
        }
    })

    # ============================================================
    # HEADER: PROFILING & RESOURCES
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# ⚙️ Profiling & Resources\n*CPU / Memory / Continuous Profiling*",
            "background_color": "pink",
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
                {"q": "avg:system.cpu.user{service:gastown-sensei OR service:openclaw} by {service}"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Memory Usage",
            "type": "timeseries",
            "requests": [
                {"q": "avg:system.mem.used{service:gastown-sensei OR service:openclaw} by {service}"}
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

    widgets.append({
        "definition": {
            "title": "Top Functions (Profiling)",
            "type": "toplist",
            "requests": [
                {"q": "top(avg:profiling.cpu.percent{service:gastown-sensei OR service:openclaw} by {function}, 10, 'mean', 'desc')"}
            ]
        }
    })

    # ============================================================
    # HEADER: COST ANALYSIS
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 💰 Cost Analysis\n*LLM Spend by Provider + Token Efficiency*",
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
            "title": "Daily Cost Trend",
            "type": "timeseries",
            "requests": [
                {"q": "cumsum(sum:ai_agent.cost.total_usd{*}.as_count()) / 1000000", "display_type": "area"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "Cost per Request",
            "type": "query_value",
            "requests": [{"q": "(sum:ai_agent.cost.total_usd{*}.as_count() / 1000000) / (sum:ai_agent.request.count{*}.as_count() + 1)"}],
            "precision": 4,
            "custom_unit": "$"
        }
    })

    widgets.append({
        "definition": {
            "title": "Token Efficiency",
            "type": "query_value",
            "requests": [{"q": "sum:ai_agent.tokens.total{direction:output}.as_count() / (sum:ai_agent.tokens.total{direction:input}.as_count() + 1)"}],
            "precision": 2,
            "custom_unit": ":1"
        }
    })

    # ============================================================
    # HEADER: DEM / RUM
    # ============================================================
    widgets.append({
        "definition": {
            "type": "note",
            "content": "# 🌐 Digital Experience (DEM/RUM)\n*Core Web Vitals + User Sessions + JS Errors*",
            "background_color": "green",
            "font_size": "18",
            "text_align": "center",
            "show_tick": False,
            "tick_pos": "50%",
            "tick_edge": "left"
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
            "title": "Core Web Vitals - LCP",
            "type": "query_value",
            "requests": [{"q": "avg:rum.largest_contentful_paint{*}"}],
            "precision": 0,
            "custom_unit": "ms"
        }
    })

    widgets.append({
        "definition": {
            "title": "JS Errors",
            "type": "timeseries",
            "requests": [
                {"q": "sum:rum.error.count{*} by {error.source}.as_count()", "display_type": "bars"}
            ]
        }
    })

    widgets.append({
        "definition": {
            "title": "User Sessions",
            "type": "query_value",
            "requests": [{"q": "sum:rum.session.count{*}.as_count()"}],
            "precision": 0
        }
    })

    return widgets


dashboard = {
    "title": "Unified Ops Dashboard - GasTown / OpenClaw / WebGUI",
    "description": "Complete AI Agent observability: APM, Logs, Profiling, Metrics, DEM",
    "widgets": create_widgets(),
    "template_variables": [
        {"name": "env", "default": "*", "prefix": "env", "available_values": ["prod", "staging", "dev", "studio", "local"]},
        {"name": "service", "default": "*", "prefix": "service", "available_values": ["gastown-sensei", "openclaw", "gastown", "ralph-loop", "claude-code", "sequential-thinking"]},
        {"name": "rig", "default": "*", "prefix": "rig_name"},
        {"name": "provider", "default": "*", "prefix": "provider", "available_values": ["anthropic", "openai", "ollama"]},
        {"name": "model", "default": "*", "prefix": "model"},
        {"name": "host", "default": "*", "prefix": "host"}
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
    parser = argparse.ArgumentParser(description="Update Gas Town unified ops dashboard (flat layout)")
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
