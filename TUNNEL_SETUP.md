# Cloudflare Tunnel Setup Guide

When running this application locally, you need to expose your local `localhost:3000` to the internet so that Twilio can reach it. We use Cloudflare Quick Tunnels for this.

**Note:** Cloudflare Quick Tunnels (`trycloudflare.com`) are temporary and will expire after a few hours or if your computer goes to sleep. Whenever it expires, you must generate a new URL and update your configuration.

---

## 1. How to Run the Tunnel

Open a new terminal window (keep your `npm run dev` running in your first terminal) and run the following command:

```bash
cloudflared tunnel --url http://localhost:3000
```

*(Note: If you don't have `cloudflared` installed, you can download it from the [Cloudflare documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).)*

---

## 2. How to Find the Webhook URL

Once you run the command, look at the terminal output. You will see a box that looks like this:

```text
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://random-words-here.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

Copy that exact URL (e.g., `https://random-words-here.trycloudflare.com`). **Do not close this terminal**, or the tunnel will shut down.

---

## 3. Where to Replace the URL (3 Places)

Whenever your tunnel URL changes, you must update it in exactly **3 places**:

### Place 1 & 2: Your `.env` File
Open the `.env` file in the root of your project directory. Update the following two variables to exactly match your new URL:

```env
PUBLIC_URL=https://random-words-here.trycloudflare.com
BASE_URL=https://random-words-here.trycloudflare.com
```

**Important:** After saving the `.env` file, go to the terminal running `npm run dev` and type `rs` (and press Enter) to restart the server so it picks up the new variables.

### Place 3: Twilio Console
Twilio needs to know where to send the call data when someone dials your number.

1. Log in to your [Twilio Console](https://console.twilio.com/).
2. Navigate to **Phone Numbers** > **Manage** > **Active Numbers**.
3. Click on your active Twilio phone number.
4. Scroll down to the **Voice Configuration** section.
5. Under **"A call comes in"**, make sure it is set to "Webhook", and paste your new URL followed by `/api/call/incoming`.

It should look exactly like this:
`https://random-words-here.trycloudflare.com/api/call/incoming`

6. Click **Save** at the bottom of the page.

---

### Troubleshooting
- **"We're sorry, an application error has occurred"**: This means Twilio is trying to reach an old/dead tunnel URL. Repeat the steps above to get a fresh URL and update it everywhere.
- **Continuous AI fallback message**: Make sure your `npm run dev` server is actually running and hasn't crashed.
