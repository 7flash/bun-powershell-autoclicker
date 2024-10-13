# bun-powershell-autoclicker

Welcome to the **bun-powershell-autoclicker**! This tool helps automate mouse actions based on screen changes with PowerShell and Bun. Let's explore the latest updates and how to use them.

## New Features 🚀

1. **Configuration Management** 📁
   - Save and load configurations for monitoring different screen areas.
   - Prompt users to use existing configurations or set up new ones.

2. **Enhanced User Interaction** 💬
   - Interactive prompts guide users through setting up monitoring areas and capturing possible screen colorings.
   - Users can specify similarity thresholds and interval periods for monitoring.

3. **Multiple Coloring Captures** 🎨
   - Capture multiple possible colorings for a monitoring area to increase detection accuracy.
   - Prompt users to capture additional colorings if needed.

## Features ✨

1. **Mouse Position Capture** 🖱️
   - Capture the current position of the mouse cursor using PowerShell integration.

2. **Rectangle Pixel Monitoring** 🎨
   - Capture all pixel colors within a defined rectangular screen area.
   - Calculate the similarity between two sets of pixel data to detect changes.

3. **Automated Mouse Actions** 🖱️
   - Move the cursor and perform clicks at specified coordinates programmatically.
   - Restore the cursor to its original position after performing actions.

4. **Similarity Calculation** 🔍
   - Compute the similarity between two pixel sets and trigger actions based on a threshold.

## Usage Instructions 📖

1. **Setup:**
   - Ensure you have PowerShell installed and accessible on your system.
   - Use Bun, a modern JavaScript runtime, to run the script.

2. **Define Monitoring Area:**
   - Run the script and follow the interactive prompts to define the monitoring area.
   - Position the cursor over the first and second corners of the target area and press ENTER to capture.

3. **Capture Possible Colorings:**
   - Capture multiple possible colorings for the defined area by following the prompts.
   - Specify similarity thresholds and monitoring intervals as needed.

4. **Monitor and Respond:**
   - The script will continuously monitor the defined area at specified intervals.
   - If the similarity between any captured and current pixel data exceeds the threshold, it will perform a click action at the center of the area.
   - The cursor will be returned to its original position after the action.

### Example Usage

To start monitoring, simply run the script:

```bash
bun index.ts
```

Follow the on-screen instructions to define your target area, capture possible colorings, and let the script handle the rest! 🖥️🔍

### Important Notes

- The similarity threshold and interval period can be customized during setup.
- Configurations can be saved and reused for future monitoring sessions.
- The script uses PowerShell for interacting with system-level APIs, which may require administrative privileges.

Enjoy automating your screen monitoring tasks with this powerful tool! If you have any questions or need further assistance, feel free to reach out. 😊
