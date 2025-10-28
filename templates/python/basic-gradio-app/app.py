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
