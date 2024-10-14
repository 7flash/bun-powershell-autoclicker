import { $ } from "bun";
import readline from "readline";
import { writeFile, readFile } from "fs/promises";

type Point = { x: number; y: number };
type Config = {
  topLeft: Point;
  bottomRight: Point;
  possibleColorings: string[][][];
  similarityThreshold: number;
  intervalPeriod: number;
};

async function getMousePosition(): Promise<Point> {
  const script = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class GetCursorPosition {
        [DllImport("user32.dll")]
        public static extern bool GetCursorPos(out POINT lpPoint);
        [StructLayout(LayoutKind.Sequential)]
        public struct POINT {
          public int X;
          public int Y;
        }
      }
"@
    $point = New-Object GetCursorPosition+POINT
    [GetCursorPosition]::GetCursorPos([ref]$point) | Out-Null
    "$($point.X),$($point.Y)"
  `;
  const result = await $`powershell -Command "${script}"`.text();
  const [x, y] = result.trim().split(',').map(Number);
  return { x, y };
}

async function getRectanglePixels(topLeft: Point, bottomRight: Point): Promise<string[][]> {
  const script = `
    Add-Type -AssemblyName System.Drawing
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class ScreenCapture {
        [DllImport("gdi32.dll")]
        public static extern int GetPixel(IntPtr hdc, int x, int y);
        [DllImport("user32.dll")]
        public static extern IntPtr GetDC(IntPtr hwnd);
        [DllImport("user32.dll")]
        public static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);
      }
"@
    $dc = [ScreenCapture]::GetDC([IntPtr]::Zero)
    $colors = @()
    for ($i = ${topLeft.x}; $i -le ${bottomRight.x}; $i++) {
      $row = @()
      for ($j = ${topLeft.y}; $j -le ${bottomRight.y}; $j++) {
        $pixel = [ScreenCapture]::GetPixel($dc, $i, $j)
        $r = ($pixel -band 0x000000FF)
        $g = (($pixel -band 0x0000FF00) -shr 8)
        $b = (($pixel -band 0x00FF0000) -shr 16)
        $row += "{0:X2}{1:X2}{2:X2}" -f $r, $g, $b
      }
      $colors += ,@($row)
    }
    [ScreenCapture]::ReleaseDC([IntPtr]::Zero, $dc)
    $colors | ConvertTo-Json -Compress
  `;
  const result = await $`powershell -Command "${script}"`.text();
  const jsonStartIndex = result.indexOf('[');
  const cleanedResult = result.slice(jsonStartIndex).trim();
  const parsedResult = JSON.parse(cleanedResult);

  return parsedResult.map((row: { value: string[] }) => row.value);
}

async function clickAt(x: number, y: number) {
  const script = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Mouse {
        [DllImport("user32.dll", CharSet = CharSet.Auto, CallingConvention = CallingConvention.StdCall)]
        public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
        private const int MOUSEEVENTF_LEFTDOWN = 0x02;
        private const int MOUSEEVENTF_LEFTUP = 0x04;
        public static void Click(int x, int y) {
          SetCursorPos(x, y);
          mouse_event(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP, x, y, 0, 0);
        }
        [DllImport("user32.dll", CharSet = CharSet.Auto, CallingConvention = CallingConvention.StdCall)]
        public static extern void SetCursorPos(int X, int Y);
      }
"@
    [Mouse]::Click(${x}, ${y})
  `;
  await $`powershell -Command "${script}"`;
}

async function moveCursorTo(x: number, y: number) {
  const script = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Mouse {
        [DllImport("user32.dll", CharSet = CharSet.Auto, CallingConvention = CallingConvention.StdCall)]
        public static extern void SetCursorPos(int X, int Y);
      }
"@
    [Mouse]::SetCursorPos(${x}, ${y})
  `;
  await $`powershell -Command "${script}"`;
}

function calculateSimilarity(rect1: string[][], rect2: string[][]): number {
  const width = rect1.length;
  const height = rect1[0].length;
  let totalDifference = 0;
  let totalPixels = 0;

  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const color1 = rect1[i][j];
      const color2 = rect2[i][j];
      const diff = calculateColorDifference(color1, color2);
      totalDifference += diff;
      totalPixels++;
    }
  }
  
  const maxDifference = totalPixels * 255 * 3;
  return 1 - (totalDifference / maxDifference);
}

function calculateColorDifference(color1: string, color2: string): number {
  const r1 = parseInt(color1.slice(0, 2), 16);
  const g1 = parseInt(color1.slice(2, 4), 16);
  const b1 = parseInt(color1.slice(4, 6), 16);
  const r2 = parseInt(color2.slice(0, 2), 16);
  const g2 = parseInt(color2.slice(2, 4), 16);
  const b2 = parseInt(color2.slice(4, 6), 16);
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

async function prompt(question: string, defaultValue: string = ""): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question} (${defaultValue}): `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function configureRectangle(): Promise<{ topLeft: Point; bottomRight: Point }> {
  console.log("🖱️ Position the cursor over the first corner of the rectangle and press ENTER...");
  await prompt(""); // Wait for user input

  const firstCorner = await getMousePosition();
  console.log(`📌 First corner captured at X: ${firstCorner.x}, Y: ${firstCorner.y}`);

  console.log("🖱️ Now position the cursor over the opposite corner of the rectangle and press ENTER...");
  await prompt(""); // Wait for user input

  const secondCorner = await getMousePosition();
  console.log(`📌 Second corner captured at X: ${secondCorner.x}, Y: ${secondCorner.y}`);

  return {
    topLeft: { x: Math.min(firstCorner.x, secondCorner.x), y: Math.min(firstCorner.y, secondCorner.y) },
    bottomRight: { x: Math.max(firstCorner.x, secondCorner.x), y: Math.max(firstCorner.y, secondCorner.y) }
  };
}

async function capturePossibleColorings(topLeft: Point, bottomRight: Point): Promise<string[][][]> {
  const colorings: string[][][] = [];

  console.log("🚨 Please move your cursor away from the selected rectangle and press ENTER to proceed with capturing.");
  await prompt(""); // Wait for user to move cursor away

  while (true) {
    const pixels = await getRectanglePixels(topLeft, bottomRight);
    colorings.push(pixels);

    const moreColors = await prompt("Would you like to capture another possible coloring", "n");
    if (moreColors.toLowerCase() === "n") break;

    console.log("🖱️ Adjust the screen as necessary and press ENTER to capture another coloring...");
    await prompt(""); // Wait for user input
  }

  return colorings;
}

async function loadConfig(configPath: string): Promise<Config> {
  const configContent = await readFile(configPath, "utf-8");
  return JSON.parse(configContent) as Config;
}

async function saveConfig(configPath: string, config: Config): Promise<void> {
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

(async () => {
  console.log("🚀 Starting the rectangle auto-clicker");

  const useExistingConfig = (await prompt("Would you like to use an existing config file", "n")).toLowerCase() === "y";
  let configs: Config[] = [];
  if (useExistingConfig) {
    const configPaths = (await prompt("Please specify the paths of the config files, separated by commas", "config.json"))
      .split(',')
      .map(path => path.trim());

    for (const configPath of configPaths) {
      const config = await loadConfig(configPath);
      configs.push(config);
    }
  } else {
    const { topLeft, bottomRight } = await configureRectangle();
    console.log(`📏 Monitoring rectangle defined from (${topLeft.x}, ${topLeft.y}) to (${bottomRight.x}, ${bottomRight.y})`);

    let possibleColorings = await capturePossibleColorings(topLeft, bottomRight);
    const similarityThreshold = parseFloat(await prompt("Set similarity threshold", "0.9"));
    const intervalPeriod = parseInt(await prompt("Set interval period in milliseconds", "20000"), 10);

    const config = { topLeft, bottomRight, possibleColorings, similarityThreshold, intervalPeriod };

    configs.push(config);

    const saveConfigChoice = await prompt("Would you like to save this configuration", "y");
    if (saveConfigChoice.toLowerCase() !== "n") {
      const configFilePath = await prompt("Enter the desired config file name", "config.json");
      await saveConfig(configFilePath, config);
    }
  }

  let currentIndex = 0;

  console.log("🔁 Starting the workflow sequence...");
  async function processConfig() {
    const config = configs[currentIndex];
    const { topLeft, bottomRight, possibleColorings, similarityThreshold, intervalPeriod } = config;
    console.log(`📋 [Config ${currentIndex + 1}/${configs.length}]`);
    console.log(`🔍 Using similarity threshold: ${similarityThreshold} and interval period: ${intervalPeriod} ms`);

    const currentPixels = await getRectanglePixels(topLeft, bottomRight);
    for (const [index, colors] of possibleColorings.entries()) {
      console.log(`🖼️ Comparing coloring ${index + 1}/${possibleColorings.length}`);
      const similarity = calculateSimilarity(colors, currentPixels);
      console.log(`🔍 Current similarity for coloring ${index + 1}: ${(similarity * 100).toFixed(2)}%`);

      if (similarity >= similarityThreshold) {
        console.log("✅ Similarity threshold met! Performing action...");

        const midpoint: Point = { x: Math.floor((topLeft.x + bottomRight.x) / 2), y: Math.floor((topLeft.y + bottomRight.y) / 2) };

        const originalPosition = await getMousePosition();
        console.log(`🖱️ Performing click at (${midpoint.x}, ${midpoint.y})`);
        await clickAt(midpoint.x, midpoint.y);
        
        console.log(`🔄 Returning cursor to original position (${originalPosition.x}, ${originalPosition.y})`);
        await moveCursorTo(originalPosition.x, originalPosition.y);

        // Rotate to the next config
        currentIndex = (currentIndex + 1) % configs.length;
        break; // Action performed, break the loop
      }
    }

    console.log("⏳ Waiting for next interval...");
    setTimeout(processConfig, config.intervalPeriod);
  }

  processConfig();
})();
