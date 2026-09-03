# =============================================================================
# ApexCalc - Local Development Server & API Bridge
# Handles static file serving and Razorpay Sandbox order creation / verification
# =============================================================================

import http.server
import socketserver
import json
import urllib.request
import base64
import hmac
import hashlib
import os

PORT = 8089
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

RAZORPAY_KEY_ID = "rzp_test_TXejJaWcbFY5He"
RAZORPAY_KEY_SECRET = "SHCT9QzbIG5Axuhi6wWzekm8"

class ApexCalcHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "authorization, content-type, apikey")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            payload = json.loads(post_body)
        except Exception:
            payload = {}

        # ----------------------------------------------------------------------
        # Endpoint: Create Razorpay Order
        # ----------------------------------------------------------------------
        if self.path.startswith("/functions/v1/create-razorpay-order"):
            plan = payload.get("plan", "yearly")
            is_yearly = plan == "yearly"
            amount = 100000 if is_yearly else 10000 # 1000 INR or 100 INR in paise

            auth_header = base64.b64encode(f"{RAZORPAY_KEY_ID}:{RAZORPAY_KEY_SECRET}".encode()).decode()
            rzp_req = urllib.request.Request(
                "https://api.razorpay.com/v1/orders",
                data=json.dumps({
                    "amount": amount,
                    "currency": "INR",
                    "receipt": f"rcpt_{int(amount)}_{os.urandom(4).hex()}",
                    "notes": {"plan": plan}
                }).encode(),
                headers={
                    "Authorization": f"Basic {auth_header}",
                    "Content-Type": "application/json"
                }
            )

            try:
                with urllib.request.urlopen(rzp_req) as resp:
                    rzp_data = json.loads(resp.read().decode("utf-8"))
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "orderId": rzp_data.get("id"),
                        "amount": rzp_data.get("amount"),
                        "currency": rzp_data.get("currency", "INR"),
                        "keyId": RAZORPAY_KEY_ID,
                        "plan": plan
                    }).encode())
            except Exception as err:
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Razorpay order failed: {str(err)}"}).encode())
            return

        # ----------------------------------------------------------------------
        # Endpoint: Verify Razorpay Payment Signature
        # ----------------------------------------------------------------------
        elif self.path.startswith("/functions/v1/verify-razorpay-payment"):
            order_id = payload.get("razorpay_order_id", "")
            payment_id = payload.get("razorpay_payment_id", "")
            signature = payload.get("razorpay_signature", "")
            plan = payload.get("plan", "yearly")

            # HMAC-SHA256 signature verification formula: order_id + "|" + payment_id
            msg = f"{order_id}|{payment_id}".encode()
            expected_sig = hmac.new(RAZORPAY_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()

            if hmac.compare_digest(expected_sig, signature):
                print(f"[VERIFIED] Razorpay payment {payment_id} verified for order {order_id}")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "verified": True,
                    "entitled": True,
                    "plan": "premium",
                    "paymentId": payment_id
                }).encode())
            else:
                print(f"[REJECTED] Signature mismatch for order {order_id}")
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "verified": False,
                    "error": "Cryptographic signature verification failed"
                }).encode())
            return

        # Fallback 404
        self.send_response(404)
        self.end_headers()

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), ApexCalcHandler) as httpd:
        print(f"ApexCalc Development Server running at http://localhost:{PORT}")
        httpd.serve_forever()
