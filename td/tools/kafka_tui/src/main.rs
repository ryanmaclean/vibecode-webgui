use std::process::Command;
use std::time::{Duration, Instant};

use crossterm::event::{self, Event, KeyCode, KeyEventKind};
use crossterm::terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen};
use crossterm::ExecutableCommand;
use ratatui::backend::CrosstermBackend;
use ratatui::layout::{Constraint, Direction, Layout};
use ratatui::style::{Color, Modifier, Style};
use ratatui::widgets::{Block, Borders, Paragraph, Row, Table};
use ratatui::Terminal;

struct App {
    status: String,
    rows: Vec<(String, String, String)>,
    last_updated: Instant,
}

impl App {
    fn new() -> Self {
        Self {
            status: String::new(),
            rows: Vec::new(),
            last_updated: Instant::now() - Duration::from_secs(5),
        }
    }
}

fn run_cmd(cmd: &str, args: &[&str]) -> String {
    let out = Command::new(cmd).args(args).output();
    match out {
        Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(e) => format!("error: {e}"),
    }
}

fn parse_consumer_groups(output: &str) -> Vec<(String, String, String)> {
    let mut rows = Vec::new();
    for line in output.lines() {
        if line.starts_with("GROUP") || line.trim().is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 7 {
            continue;
        }
        let group = parts[0].to_string();
        let topic = parts[1].to_string();
        let lag = parts[5].to_string();
        rows.push((group, topic, lag));
    }
    rows
}

fn build_rows(groups: &str, brokers: &str) -> (Vec<(String, String, String)>, String) {
    let mut rows = Vec::new();
    let mut status = String::new();
    for g in groups.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()) {
        let output = run_cmd(
            "kafka-consumer-groups",
            &["--bootstrap-server", brokers, "--describe", "--group", g],
        );
        let mut parsed = parse_consumer_groups(&output);
        rows.append(&mut parsed);
        if output.starts_with("error") {
            status = output;
        }
    }
    (rows, status)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let brokers = std::env::var("TD_KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".to_string());
    let groups = std::env::var("TD_CONSUMER_GROUPS")
        .unwrap_or_else(|_| "tundra-td-event-emitter,tundra-observer,gastown-bridge".to_string());

    enable_raw_mode()?;
    let mut stdout = std::io::stdout();
    stdout.execute(EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut app = App::new();
    app.last_updated = Instant::now();

    loop {
        if app.last_updated.elapsed() > Duration::from_secs(2) {
            let (rows, status) = build_rows(&groups, &brokers);
            app.rows = rows;
            app.status = status;
            app.last_updated = Instant::now();
        }

        terminal.draw(|f| {
            let size = f.size();
            let layout = Layout::default()
                .direction(Direction::Vertical)
                .constraints([Constraint::Length(3), Constraint::Min(5)].as_ref())
                .split(size);

            let header = Paragraph::new(format!("Kafka Queue TUI  |  brokers: {brokers}  |  groups: {groups}"))
                .block(Block::default().borders(Borders::ALL).title("tundra"));
            f.render_widget(header, layout[0]);

            let rows = app.rows.iter().map(|(g, t, l)| {
                Row::new(vec![g.clone(), t.clone(), l.clone()])
            });
            let table = Table::new(rows, [
                Constraint::Percentage(35),
                Constraint::Percentage(45),
                Constraint::Percentage(20),
            ])
            .block(Block::default().borders(Borders::ALL).title("consumer lag"))
            .header(
                Row::new(vec!["group", "topic", "lag"]).style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD))
            );
            f.render_widget(table, layout[1]);
        })?;

        if event::poll(Duration::from_millis(150))? {
            if let Event::Key(key) = event::read()? {
                if key.kind == KeyEventKind::Press {
                    match key.code {
                        KeyCode::Char('q') | KeyCode::Esc => break,
                        _ => {}
                    }
                }
            }
        }
    }

    disable_raw_mode()?;
    terminal.backend_mut().execute(LeaveAlternateScreen)?;
    terminal.show_cursor()?;
    Ok(())
}
