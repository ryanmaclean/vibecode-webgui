#!/usr/bin/env python3
"""Simple brace matching checker"""
import sys

def check_braces(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    stack = []
    line_num = 1
    char_pos = 0
    
    for i, char in enumerate(content):
        if char == '\n':
            line_num += 1
            char_pos = 0
        char_pos += 1
        
        if char == '{':
            stack.append(('{', line_num, char_pos))
        elif char == '}':
            if not stack:
                print(f"Unexpected closing brace at line {line_num}, char {char_pos}")
            else:
                open_brace, open_line, open_pos = stack.pop()
    
    if stack:
        print("Unclosed opening braces:")
        for brace, line, pos in stack:
            print(f"  Line {line}, char {pos}")
    else:
        print("All braces are properly matched")

if __name__ == '__main__':
    check_braces(sys.argv[1])