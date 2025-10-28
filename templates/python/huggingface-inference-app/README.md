# Hugging Face Inference App Template (BYOK)

This template demonstrates the "Bring Your Own Key" (BYOK) pattern for using the Hugging Face Hub. It provides a simple, command-line application that uses a personal Hugging Face API key to authenticate, download a **gated model** (`meta-llama/Llama-2-7b-chat-hf`), and perform inference.

This is essential for using models that require accepting a license agreement or for accessing private models.

## How It Works

1.  **Authentication:** The application loads a `HUGGINGFACE_API_KEY` from a `.env` file.
2.  **Login:** It uses the `huggingface_hub.login()` function to programmatically authenticate with the Hugging Face Hub. This allows the `transformers` library to access gated or private models on your behalf.
3.  **Pipeline:** It uses the `transformers` `pipeline` to download the model and tokenizer (this will take a long time and significant disk space on the first run).
4.  **Inference:** It provides an interactive loop where you can enter prompts and get responses from the Llama-2 model.

## Prerequisites

-   Python 3.8+
-   A Hugging Face account.
-   A Hugging Face User Access Token with `read` or `write` permissions. You can generate one from your [Hugging Face settings](https://huggingface.co/settings/tokens).

## How to Use

1.  **Accept the Model License:**
    -   **THIS IS A CRITICAL STEP.** Before running the app, you must go to the model's page on the Hugging Face Hub and accept its license terms.
    -   [Click here to visit the Llama-2-7b-chat-hf model page](https://huggingface.co/meta-llama/Llama-2-7b-chat-hf) and accept the agreement.
    -   If you do not do this, the application will fail to download the model.

2.  **Clone the repository and navigate to this directory.**

3.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate
    # On Windows, use: venv\Scripts\activate
    ```

4.  **Install the required packages:**
    ```bash
    pip install -r requirements.txt
    ```

5.  **Configure your credentials:**
    -   Rename the `.env.example` file to `.env`.
    -   Open the `.env` file and add your Hugging Face API key.

6.  **Run the application:**
    ```bash
    python app.py
    ```
    The first time you run the app, it will download the Llama-2 model, which is very large (~14 GB). This will take a significant amount of time and requires a stable internet connection.

7.  **Chat with the model!** Once the model is loaded, you can enter prompts and get responses. To exit, type `exit` and press Enter.
