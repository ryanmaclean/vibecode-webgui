# Basic Chat Application Template

This template provides a simple, command-line chat application that demonstrates how to connect to and interact with the Azure OpenAI API using the official Python SDK.

It is adapted from the "Building Chat Applications" lesson in Microsoft's `generative-ai-for-beginners` course.

## Features

- **Simple & Clear:** A single Python script (`app.py`) with clear, commented code.
- **Secure Configuration:** Loads API keys and endpoints from a `.env` file to keep your credentials safe.
- **Interactive Chat:** A straightforward command-line interface to send prompts and receive responses.
- **Easy Setup:** A `requirements.txt` file is included for one-step dependency installation.

## Prerequisites

- Python 3.8+
- An Azure account with an active Azure OpenAI Service resource. You will need:
  - Your API Key
  - Your resource endpoint URL
  - The name of your model deployment

## How to Use

1.  **Clone the repository and navigate to this directory.**

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

4.  **Configure your credentials:**
    -   Rename the `.env.example` file to `.env`.
    -   Open the `.env` file and add your Azure OpenAI API key, endpoint, and deployment name.

5.  **Run the application:**
    ```bash
    python app.py
    ```

6.  **Start chatting!** Type your message and press Enter. To exit, type `exit` and press Enter.
