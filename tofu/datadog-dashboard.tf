# Datadog Dashboard: Azure DB for PostgreSQL Flex Server Overview
# Managed via Datadog Terraform provider to avoid installing K8s Operator CRDs

resource "datadog_dashboard_json" "azuredbforpostgresqlflexserveroverview" {
  count = var.enable_datadog_monitoring ? 1 : 0

  dashboard = <<-JSON
  {
    "title": "Azure DB for PostgreSQL Flex Server Overview",
    "description": "This dashboard provides key Azure DB for PostgreSQL metrics so you can monitor your databases' utilization, storage and network.\n\nIt will provide you the opportunity to spot potential issues at a glance. For further reading on monitoring Azure DB for PostgreSQL Databases:\n\n- [Datadog’s Azure SQL Databases Integration Documentation](https://docs.datadoghq.com/integrations/azure_db_for_postgresql/) (cloned)",
    "widgets": [
      {
        "id": 560346242821786,
        "definition": {
          "title": "Flexible Servers",
          "background_color": "vivid_blue",
          "show_title": true,
          "type": "group",
          "layout_type": "ordered",
          "widgets": [
            {
              "id": 658163413094056,
              "definition": {
                "type": "note",
                "content": "Top-level metrics found for standard Azure DB for PostgreSQL are also available for flexible servers including CPU utilization, active connections, and Iops.\n",
                "background_color": "blue",
                "font_size": "14",
                "text_align": "left",
                "vertical_align": "center",
                "show_tick": true,
                "tick_pos": "50%",
                "tick_edge": "right",
                "has_padding": true
              },
              "layout": {"x": 0, "y": 0, "width": 2, "height": 2}
            },
            {
              "id": 5940690079037796,
              "definition": {
                "title": "Storage used by DB",
                "title_size": "16",
                "title_align": "left",
                "show_legend": false,
                "legend_layout": "auto",
                "legend_columns": ["avg", "min", "max", "value", "sum"],
                "time": {"type": "live", "unit": "hour", "value": 4},
                "type": "timeseries",
                "requests": [
                  {
                    "formulas": [{"formula": "query1"}],
                    "queries": [
                      {
                        "data_source": "metrics",
                        "name": "query1",
                        "query": "avg:azure.dbforpostgresql_flexibleservers.storage_used{*} by {name}"
                      }
                    ],
                    "response_format": "timeseries",
                    "style": {"palette": "dog_classic", "line_type": "solid", "line_width": "normal"},
                    "display_type": "line"
                  }
                ],
                "custom_links": []
              },
              "layout": {"x": 2, "y": 0, "width": 4, "height": 2}
            },
            {
              "id": 8657431845118170,
              "definition": {
                "title": "Bandwidth Consumption (%)",
                "title_size": "16",
                "title_align": "left",
                "show_legend": false,
                "legend_layout": "auto",
                "legend_columns": ["avg", "min", "max", "value", "sum"],
                "time": {"type": "live", "unit": "hour", "value": 4},
                "type": "timeseries",
                "requests": [
                  {
                    "formulas": [{"style": {"palette": "classic", "palette_index": 1}, "formula": "query1"}],
                    "queries": [
                      {"data_source": "metrics", "name": "query1", "query": "avg:azure.dbforpostgresql_flexibleservers.disk_bandwidth_consumed_percentage{*}"}
                    ],
                    "response_format": "timeseries",
                    "style": {"palette": "warm", "line_type": "solid", "line_width": "normal"},
                    "display_type": "line"
                  }
                ],
                "custom_links": []
              },
              "layout": {"x": 6, "y": 0, "width": 6, "height": 2}
            },
            {
              "id": 2344097152654062,
              "definition": {
                "title": "Active Connections",
                "title_size": "16",
                "title_align": "left",
                "show_legend": false,
                "legend_layout": "auto",
                "legend_columns": ["avg", "min", "max", "value", "sum"],
                "time": {"type": "live", "unit": "hour", "value": 4},
                "type": "timeseries",
                "requests": [
                  {
                    "formulas": [{"style": {"palette": "dog_classic"}, "formula": "query2"}],
                    "queries": [
                      {"data_source": "metrics", "name": "query2", "query": "sum:azure.dbforpostgresql_flexibleservers.active_connections{*} by {azure_postgresql_flexible_server}.weighted()"}
                    ],
                    "response_format": "timeseries",
                    "style": {"palette": "dog_classic", "line_type": "solid", "line_width": "normal"},
                    "display_type": "bars"
                  }
                ],
                "markers": [],
                "custom_links": []
              },
              "layout": {"x": 0, "y": 2, "width": 6, "height": 2}
            },
            {
              "id": 1852916752984374,
              "definition": {
                "title": "Network Ingress & Egress",
                "title_size": "16",
                "title_align": "left",
                "show_legend": false,
                "legend_layout": "auto",
                "legend_columns": ["avg", "min", "max", "value", "sum"],
                "time": {"type": "live", "unit": "hour", "value": 4},
                "type": "timeseries",
                "requests": [
                  {
                    "formulas": [{"formula": "query1"}, {"formula": "query2"}],
                    "queries": [
                      {"data_source": "metrics", "name": "query1", "query": "avg:azure.dbforpostgresql_servers.network_bytes_ingress{*}"},
                      {"data_source": "metrics", "name": "query2", "query": "sum:azure.dbforpostgresql_servers.network_bytes_egress{*}.as_count()"}
                    ],
                    "response_format": "timeseries",
                    "style": {"palette": "dog_classic", "line_type": "solid", "line_width": "normal"},
                    "display_type": "line"
                  }
                ],
                "custom_links": []
              },
              "layout": {"x": 6, "y": 2, "width": 6, "height": 2}
            },
            {
              "id": 655599332561926,
              "definition": {
                "title": "CPU Utilization by Cluster",
                "title_size": "16",
                "title_align": "left",
                "show_legend": true,
                "legend_layout": "vertical",
                "legend_columns": ["avg", "max", "value"],
                "type": "timeseries",
                "requests": [
                  {
                    "formulas": [{"formula": "query1"}],
                    "queries": [
                      {"query": "avg:azure.dbforpostgresql_flexibleservers.cpu_percent{*} by {name}", "data_source": "metrics", "name": "query1"}
                    ],
                    "response_format": "timeseries",
                    "style": {"palette": "dog_classic", "line_type": "solid", "line_width": "normal"},
                    "display_type": "line"
                  }
                ],
                "yaxis": {"include_zero": true, "scale": "linear", "label": "", "min": "auto", "max": "auto"},
                "markers": []
              },
              "layout": {"x": 0, "y": 4, "width": 6, "height": 2}
            },
            {
              "id": 3528308829143398,
              "definition": {
                "title": "IOPs by Cluster",
                "title_size": "16",
                "title_align": "left",
                "show_legend": true,
                "legend_layout": "vertical",
                "legend_columns": ["max", "value", "avg"],
                "type": "timeseries",
                "requests": [
                  {
                    "formulas": [{"formula": "query1"}],
                    "queries": [
                      {"query": "sum:azure.dbforpostgresql_flexibleservers.iops{*} by {name}.as_count()", "data_source": "metrics", "name": "query1"}
                    ],
                    "response_format": "timeseries",
                    "style": {"palette": "dog_classic", "line_type": "solid", "line_width": "normal"},
                    "display_type": "line"
                  }
                ],
                "yaxis": {"include_zero": true, "scale": "linear", "label": "", "min": "auto", "max": "auto"},
                "markers": []
              },
              "layout": {"x": 6, "y": 4, "width": 6, "height": 2}
            }
          ]
        },
        "layout": {"x": 0, "y": 0, "width": 12, "height": 7}
      }
    ],
    "template_variables": [],
    "layout_type": "ordered",
    "notify_list": [],
    "reflow_type": "fixed",
    "is_read_only": false
  }
  JSON
}
