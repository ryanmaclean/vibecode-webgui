package sub

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type item struct {
	title string
	desc  string
}

func (i item) Title() string       { return i.title }
func (i item) Description() string { return i.desc }
func (i item) FilterValue() string { return i.title }

type model struct {
	list   list.Model
	choice item
	done   bool
}

func newModel(items []list.Item, title string) model {
	l := list.New(items, list.NewDefaultDelegate(), 0, 0)
	l.Title = title
	l.SetShowHelp(true)
	return model{list: l}
}

func (m model) Init() tea.Cmd { return nil }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.list.SetSize(msg.Width, msg.Height-2)
	case tea.KeyMsg:
		switch msg.String() {
		case "enter":
			if it, ok := m.list.SelectedItem().(item); ok {
				m.choice = it
				m.done = true
				return m, tea.Quit
			}
		case "q", "ctrl+c":
			m.done = true
			return m, tea.Quit
		}
	}
	var cmd tea.Cmd
	m.list, cmd = m.list.Update(msg)
	return m, cmd
}

func (m model) View() string {
	if m.done {
		return ""
	}
	return lipgloss.NewStyle().Padding(1, 2).Render(m.list.View())
}

func runMenu(items []item, title string) (item, bool) {
	litems := make([]list.Item, 0, len(items))
	for _, it := range items {
		litems = append(litems, it)
	}
	p := tea.NewProgram(newModel(litems, title))
	m, err := p.Run()
	if err != nil {
		return item{}, false
	}
	if md, ok := m.(model); ok {
		return md.choice, md.done && md.choice.title != ""
	}
	return item{}, false
}

func viewBanner(title string) string {
	accent := lipgloss.NewStyle().Foreground(lipgloss.Color("212")).Bold(true)
	muted := lipgloss.NewStyle().Foreground(lipgloss.Color("242"))
	return accent.Render(title) + "\n" + muted.Render(time.Now().Format(time.RFC1123))
}

func printBanner() {
	fmt.Fprintln(os.Stdout, viewBanner("Tundra Dome"))
}

func parseLaneLabel(label string) string {
	parts := strings.Split(label, " ")
	if len(parts) == 0 {
		return "standard"
	}
	switch parts[0] {
	case "Critical":
		return "critical"
	case "Experimental":
		return "experimental"
	default:
		return "standard"
	}
}
