package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

const (
	// Colors
	primaryColor   = lipgloss.Color("#00D9FF") // Datadog blue
	successColor   = lipgloss.Color("#00C851") // Success green
	warningColor   = lipgloss.Color("#FF8800") // Warning orange
	errorColor     = lipgloss.Color("#FF4444") // Error red
	subtleColor    = lipgloss.Color("#666666") // Subtle gray
)

var (
	titleStyle = lipgloss.NewStyle().
		Foreground(primaryColor).
		Bold(true).
		Padding(0, 1)

	subtitleStyle = lipgloss.NewStyle().
		Foreground(subtleColor).
		Italic(true)

	successStyle = lipgloss.NewStyle().
		Foreground(successColor).
		Bold(true)

	errorStyle = lipgloss.NewStyle().
		Foreground(errorColor).
		Bold(true)

	warningStyle = lipgloss.NewStyle().
		Foreground(warningColor).
		Bold(true)

	boxStyle = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(primaryColor).
		Padding(1, 2).
		Margin(1, 0)
)

type screen int

const (
	menuScreen screen = iota
	statusScreen
	setupScreen
	demoScreen
	helpScreen
)

type menuItem struct {
	title       string
	description string
	action      string
}

func (m menuItem) Title() string       { return m.title }
func (m menuItem) Description() string { return m.description }
func (m menuItem) FilterValue() string { return m.title }

type model struct {
	screen    screen
	list      list.Model
	spinner   spinner.Model
	progress  progress.Model
	loading   bool
	status    string
	logs      []string
	err       error
	width     int
	height    int
}

type statusMsg struct {
	message string
	isError bool
}

type logMsg string

type doneMsg struct{}

func initialModel() model {
	items := []list.Item{
		menuItem{
			title:       "🔍 Check DBM Status",
			description: "Verify Datadog DBM setup for pgvector on PostgreSQL",
			action:      "status",
		},
		menuItem{
			title:       "🚀 Setup DBM Demo",
			description: "Install and configure pgvector + PostgreSQL + Datadog DBM",
			action:      "setup",
		},
		menuItem{
			title:       "🎯 Run Vector Demo",
			description: "Generate pgvector activity and view in Datadog",
			action:      "demo",
		},
		menuItem{
			title:       "📊 Open Datadog Dashboard",
			description: "Launch Datadog Database Monitoring in browser",
			action:      "dashboard",
		},
		menuItem{
			title:       "❓ Help & Troubleshooting",
			description: "Common issues and solutions",
			action:      "help",
		},
		menuItem{
			title:       "🚪 Exit",
			description: "Exit the demo",
			action:      "exit",
		},
	}

	l := list.New(items, list.NewDefaultDelegate(), 0, 0)
	l.Title = "VibeCode pgvector + Datadog DBM Demo"
	l.SetShowStatusBar(false)
	l.SetFilteringEnabled(false)
	l.Styles.Title = titleStyle

	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(primaryColor)

	p := progress.New(progress.WithDefaultGradient())

	return model{
		screen:   menuScreen,
		list:     l,
		spinner:  s,
		progress: p,
		logs:     []string{},
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, tea.EnterAltScreen)
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.loading {
			return m, nil
		}

		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "esc":
			if m.screen != menuScreen {
				m.screen = menuScreen
				m.logs = []string{}
				return m, nil
			}
			return m, tea.Quit
		case "enter":
			if m.screen == menuScreen {
				if selectedItem, ok := m.list.SelectedItem().(menuItem); ok {
					return m.handleAction(selectedItem.action)
				}
			}
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.list.SetWidth(msg.Width)
		m.list.SetHeight(msg.Height - 4)
		return m, nil

	case statusMsg:
		m.loading = false
		m.status = msg.message
		if msg.isError {
			m.err = fmt.Errorf(msg.message)
		} else {
			m.err = nil
		}
		return m, nil

	case logMsg:
		m.logs = append(m.logs, string(msg))
		if len(m.logs) > 20 {
			m.logs = m.logs[1:]
		}
		return m, nil

	case doneMsg:
		m.loading = false
		return m, nil

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	}

	if !m.loading && m.screen == menuScreen {
		var cmd tea.Cmd
		m.list, cmd = m.list.Update(msg)
		return m, cmd
	}

	return m, nil
}

func (m model) handleAction(action string) (model, tea.Cmd) {
	switch action {
	case "status":
		m.screen = statusScreen
		m.loading = true
		return m, tea.Batch(
			m.spinner.Tick,
			m.runCommand("./scripts/verify-datadog-dbm.sh", "Checking DBM status..."),
		)
	case "setup":
		m.screen = setupScreen
		m.loading = true
		return m, tea.Batch(
			m.spinner.Tick,
			m.runCommand("./scripts/verify-datadog-dbm.sh", "Setting up pgvector + Datadog DBM..."),
		)
	case "demo":
		m.screen = demoScreen
		m.loading = true
		return m, tea.Batch(
			m.spinner.Tick,
			m.runCommand("./scripts/generate-vector-activity.sh", "Generating vector activity..."),
		)
	case "dashboard":
		go func() {
			exec.Command("open", "https://app.datadoghq.com/databases").Start()
		}()
		return m, tea.Sequence(
			func() tea.Msg {
				return statusMsg{message: "Opening Datadog Database Monitoring dashboard...", isError: false}
			},
			tea.Tick(time.Second*2, func(t time.Time) tea.Msg {
				return doneMsg{}
			}),
		)
	case "help":
		m.screen = helpScreen
		return m, nil
	case "exit":
		return m, tea.Quit
	}
	return m, nil
}

func (m model) runCommand(cmd, description string) tea.Cmd {
	return func() tea.Msg {
		// Split command and args
		parts := strings.Fields(cmd)
		if len(parts) == 0 {
			return statusMsg{message: "Invalid command", isError: true}
		}

		command := exec.Command(parts[0], parts[1:]...)
		command.Dir = "."

		output, err := command.CombinedOutput()
		if err != nil {
			return statusMsg{message: fmt.Sprintf("Error: %s\n%s", err.Error(), string(output)), isError: true}
		}

		return statusMsg{message: string(output), isError: false}
	}
}

func (m model) View() string {
	switch m.screen {
	case menuScreen:
		return m.renderMenu()
	case statusScreen:
		return m.renderStatus("DBM Status Check")
	case setupScreen:
		return m.renderStatus("DBM Setup")
	case demoScreen:
		return m.renderStatus("Vector Demo")
	case helpScreen:
		return m.renderHelp()
	default:
		return m.renderMenu()
	}
}

func (m model) renderMenu() string {
	header := titleStyle.Render("🐘 VibeCode pgvector + Datadog DBM Demo") + "\n" +
		subtitleStyle.Render("Interactive demo of pgvector on PostgreSQL with Datadog Database Monitoring") + "\n\n"

	if m.width > 0 {
		return header + m.list.View()
	}
	return header + "Loading..."
}

func (m model) renderStatus(title string) string {
	header := titleStyle.Render("🔍 " + title) + "\n\n"

	if m.loading {
		return header + m.spinner.View() + " Working...\n\n" +
			subtitleStyle.Render("Press 'esc' to return to menu")
	}

	content := ""
	if m.err != nil {
		content = errorStyle.Render("❌ Error:\n") + m.status
	} else {
		content = successStyle.Render("✅ Success:\n") + m.status
	}

	footer := "\n\n" + subtitleStyle.Render("Press 'esc' to return to menu")

	return boxStyle.Render(header + content + footer)
}

func (m model) renderHelp() string {
	help := titleStyle.Render("❓ Help & Troubleshooting") + "\n\n" +
		successStyle.Render("🎯 Quick Start:") + "\n" +
		"1. Run 'Check DBM Status' to verify your setup\n" +
		"2. Run 'Setup DBM Demo' if anything is missing\n" +
		"3. Run 'Vector Demo' to generate activity\n" +
		"4. Open Datadog Dashboard to see results\n\n" +

		warningStyle.Render("🔧 Requirements:") + "\n" +
		"• Kubernetes cluster (KIND, minikube, etc.)\n" +
		"• kubectl configured and working\n" +
		"• Datadog API key (optional for local dev)\n" +
		"• Docker for PostgreSQL container\n\n" +

		errorStyle.Render("🚨 Common Issues:") + "\n" +
		"• No PostgreSQL pod: Run 'Setup DBM Demo'\n" +
		"• No Datadog data: Check DD_API_KEY environment variable\n" +
		"• Permission errors: Ensure kubectl has cluster access\n" +
		"• Network issues: Verify cluster connectivity\n\n" +

		subtitleStyle.Render("💡 Pro Tips:") + "\n" +
		"• Data appears in Datadog within 5-10 minutes\n" +
		"• Run vector demo multiple times for more activity\n" +
		"• Check logs with: kubectl logs -n vibecode postgres-pod\n" +
		"• Monitor with: kubectl get pods -n vibecode\n\n" +

		subtitleStyle.Render("Press 'esc' to return to menu")

	return boxStyle.Render(help)
}

func main() {
	// Initialize Datadog tracer for DBM-APM connection
	// Docs: https://docs.datadoghq.com/database_monitoring/connect_dbm_and_apm/?tab=go
	tracer.Start(
		tracer.WithService("vibecode-demo"),
		tracer.WithEnv(getEnv("DD_ENV", "development")),
		tracer.WithVersion(getEnv("DD_VERSION", "0.1.0-dev")),
		tracer.WithGlobalTag("deployment.environment", getEnv("DD_ENV", "development")),
		tracer.WithGlobalTag("service.name", "vibecode-demo"),
		tracer.WithGlobalTag("service.version", getEnv("DD_VERSION", "0.1.0-dev")),
		tracer.WithGlobalTag("git.repository.url", "https://github.com/vibecode/vibecode-webgui"),
	)
	defer tracer.Stop()

	// Check if we're in the right directory
	if _, err := os.Stat("scripts/verify-datadog-dbm.sh"); os.IsNotExist(err) {
		fmt.Println(errorStyle.Render("❌ Error: Must run from vibecode-webgui root directory"))
		fmt.Println("Current directory should contain scripts/verify-datadog-dbm.sh")
		os.Exit(1)
	}

	p := tea.NewProgram(
		initialModel(),
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	if _, err := p.Run(); err != nil {
		log.Fatal(err)
	}
}

// Helper function to get environment variables with defaults
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
