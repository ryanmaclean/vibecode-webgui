
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import gradio as gr

def greet(name):
    return "Hello, " + name + "!"

iface = gr.Interface(
    fn=greet, 
    inputs="text", 
    outputs="text",
    title="Simple Greeter",
    description="Enter your name to get a greeting."
)

if __name__ == "__main__":
    # The launch() method creates a local web server and provides a public link if share=True
    iface.launch()