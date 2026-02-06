package commands

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// ScriptProxyCommand delegates execution to a bash or python script.
type ScriptProxyCommand struct {
	name        string
	description string
	scriptPath  string
	interpreter string
}

// NewScriptProxyCommand creates a script proxy command.
func NewScriptProxyCommand(name, description, scriptPath, interpreter string) *ScriptProxyCommand {
	return &ScriptProxyCommand{
		name:        name,
		description: description,
		scriptPath:  scriptPath,
		interpreter: interpreter,
	}
}

func (c *ScriptProxyCommand) Name() string {
	return c.name
}

func (c *ScriptProxyCommand) Description() string {
	return c.description
}

func (c *ScriptProxyCommand) Help() {
	fmt.Printf("Usage: dd %s [options]\n", c.name)
	fmt.Println()
	fmt.Println(c.description)
	fmt.Println()
	fmt.Printf("This command proxies to %s\n", c.scriptPath)
}

func (c *ScriptProxyCommand) Run(args []string) error {
	scriptPath, err := resolveScriptPath(c.scriptPath)
	if err != nil {
		return err
	}

	interpreter := resolveInterpreter(c.interpreter)
	if interpreter == "" {
		return fmt.Errorf("interpreter not found for %s", c.name)
	}

	cmd := exec.Command(interpreter, append([]string{scriptPath}, args...)...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func resolveInterpreter(interpreter string) string {
	if interpreter == "" {
		return ""
	}

	if interpreter == "python3" {
		if env := os.Getenv("DD_SKILL_PYTHON"); env != "" {
			return env
		}
	}

	return interpreter
}

func resolveScriptPath(scriptPath string) (string, error) {
	if filepath.IsAbs(scriptPath) {
		if fileExists(scriptPath) {
			return scriptPath, nil
		}
		return "", fmt.Errorf("script not found: %s", scriptPath)
	}

	root, err := resolveSkillRoot()
	if err != nil {
		return "", err
	}

	candidate := filepath.Join(root, scriptPath)
	if !fileExists(candidate) {
		return "", fmt.Errorf("script not found: %s", candidate)
	}
	return candidate, nil
}

func resolveSkillRoot() (string, error) {
	if env := os.Getenv("DD_SKILL_ROOT"); env != "" {
		if dirExists(env) && fileExists(filepath.Join(env, "SKILL.md")) {
			return env, nil
		}
	}

	if exe, err := os.Executable(); err == nil {
		if root, ok := findSkillRoot(filepath.Dir(exe)); ok {
			return root, nil
		}
	}

	if cwd, err := os.Getwd(); err == nil {
		if root, ok := findSkillRoot(cwd); ok {
			return root, nil
		}
	}

	return "", errors.New("could not locate skill root (set DD_SKILL_ROOT)")
}

func findSkillRoot(start string) (string, bool) {
	dir := start
	for i := 0; i < 6; i++ {
		if fileExists(filepath.Join(dir, "SKILL.md")) {
			return dir, true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return "", false
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}
