## bun-powershell-autoclicker

### Features ✨

1. **Mouse Position Capture** 🖱️
   - Capture the current position of the mouse cursor using PowerShell integration.
   
2. **Rectangle Pixel Monitoring** 🎨
   - Capture all pixel colors within a defined rectangular screen area.
   - Calculate the similarity between two sets of pixel data to detect changes.

3. **Automated Mouse Actions** 🖱️
   - Move the cursor and perform clicks at specified coordinates programmatically.
   - Restore cursor to its original position after performing actions.

4. **Similarity Calculation** 🔍
   - Compute the similarity between two pixel sets and trigger actions based on a threshold.

### Usage Instructions 📖

1. **Setup:**
   - Ensure you have PowerShell installed and accessible on your system.
   - Use Bun, a modern JavaScript runtime, to run the script.

2. **Define Monitoring Area:**
   - Run the script and follow the prompts to define the monitoring area.
   - Move the cursor to the first corner of the target area and wait for the capture.
   - Move the cursor to the opposite corner and wait for the capture.

3. **Monitor and Respond:**
   - The script will continuously monitor the defined area every 20 seconds.
   - If the similarity between the initial and current pixel data exceeds 90%, it will perform a click action at the center of the area.
   - The cursor will be returned to its original position after the action.

### Example Usage

To start monitoring, simply run the script:

```bash
bun index.ts
```

Follow the on-screen instructions to define your target area, and let the script handle the rest! 🖥️🔍

### Important Notes

- The similarity threshold is set to 90% by default. Adjust this value in the script if needed.
- The script uses PowerShell for interacting with system-level APIs, which may require administrative privileges.

Enjoy automating your screen monitoring tasks with this powerful tool! If you have any questions or need further assistance, feel free to reach out. 😊
