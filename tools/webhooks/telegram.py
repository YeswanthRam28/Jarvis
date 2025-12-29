import requests
from tools.base import BaseTool, ToolResult, ToolParameter

class TelegramAlertTool(BaseTool):
    @property
    def description(self):
        return "Send a Telegram notification through n8n"

    @property
    def parameters(self):
        return [
            ToolParameter(name="message", type="string", description="Message to send", required=True)
        ]

    def execute(self, message: str, **_):
        try:
            # Use the production webhook URL as the workflow should be activated
            url = "http://localhost:5678/webhook-test/c33bc6f1-27ce-4b31-8d0e-0dd743038e7c"
            r = requests.post(url, json={"message": message})
            if r.status_code == 200:
                return ToolResult(success=True, result="Alert sent")
            else:
                return ToolResult(success=False, error=f"Failed to send alert: {r.status_code} {r.text}")
        except Exception as e:
            return ToolResult(success=False, error=str(e))
