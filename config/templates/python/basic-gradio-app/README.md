# Basic Gradio App Template

This template provides a minimal, "Hello World" Gradio application. It serves as the foundation for the integrated Gradio Space Editor in VibeCode.

## How It Works

The `app.py` script uses the `gradio` library to create a simple web interface for a Python function. In this case, it's a `greet` function that takes a name as input and returns a greeting.

## Prerequisites

-   Python 3.8+

## How to Use

1.  **Navigate to this directory.**

2.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate
    # On Windows, use: venv\Scripts\activate
    ```

3.  **Install the required packages:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Run the application:**
    ```bash
    python app.py
    ```

5.  **View the app:**
    The application will start a local web server. Open the URL printed in your terminal (usually `http://127.0.0.1:7860`) in your web browser to interact with the app.
