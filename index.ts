import { $ } from "bun";
import readline from "readline";
import { writeFile, readFile } from "fs/promises";

type Point = { x: number; y: number };
type Config = {
  initialRect: { topLeft: Point; bottomRight: Point };
  colorStates: string[][][];
  similarityThreshold: number;
  intervalPeriod: number;
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function getMousePosition(): Promise<Point> {
  const script = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class GetCursorPosition {
        [StructLayout(LayoutKind.Sequential)]
        public struct POINT {
          public int X;
          public int Y;
        }
        [DllImport("user32.dll")]
        public static extern bool GetCursorPos(out POINT lpPoint);
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

async function captureInitialArea(): Promise<{ topLeft: Point; bottomRight: Point }> {
  console.log("🖱️ Please place the cursor over the first corner of the target area and press Enter...");
  await askQuestion("");
  const firstCorner = await getMousePosition();
  console.log(`📌 First corner captured at X: ${firstCorner.x}, Y: ${firstCorner.y}`);

  console.log("🖱️ Now place the cursor over the opposite corner of the target area and press Enter...");
  await askQuestion("");
  const secondCorner = await getMousePosition();
  console.log(`📌 Second corner captured at X: ${secondCorner.x}, Y: ${secondCorner.y}`);

  return {
    topLeft: {
      x: Math.min(firstCorner.x, secondCorner.x),
      y: Math.min(firstCorner.y, secondCorner.y),
    },
    bottomRight: {
      x: Math.max(firstCorner.x, secondCorner.x),
      y: Math.max(firstCorner.y, secondCorner.y),
    },
  };
}

async function captureColorStates(
  topLeft: Point,
  bottomRight: Point
): Promise<string[][][]> {
  const colorStates: string[][][] = [];
  let addMore = true;

  while (addMore) {
    console.log("🖼️ Capturing color state...");
    const pixels = await getRectanglePixels(topLeft, bottomRight);
    colorStates.push(pixels);

    const answer = await askQuestion("Do you want to add another color state? (Y/N): ");
    addMore = answer.trim().toUpperCase() === "Y";
    if (addMore) {
      console.log("🖱️ Adjust the screen for the new state and press Enter...");
      await askQuestion("");
    }
  }

  return colorStates;
}

async function saveConfig(config: Config, filename: string) {
  const configData = JSON.stringify(config, null, 2);
  await writeFile(filename, configData, "utf-8");
  console.log(`💾 Configuration saved to ${filename}`);
}

async function loadConfig(filename: string): Promise<Config> {
  const configData = await readFile(filename, "utf-8");
  return JSON.parse(configData);
}

(async () => {
  console.log("🚀 Starting the rectangle monitoring script...");

  const useExistingConfig = (await askQuestion("Do you want to use an existing configuration? (Y/N): "))
    .trim()
    .toUpperCase() === "Y";

  let config: Config;

  if (useExistingConfig) {
    const configPath = await askQuestion("Enter the path to the configuration file: ");
    config = await loadConfig(configPath.trim());
    console.log("🔧 Configuration loaded.");
  } else {
    const initialRect = await captureInitialArea();
    const colorStates = await captureColorStates(initialRect.topLeft, initialRect.bottomRight);
    const similarityThreshold = parseFloat(
      await askQuestion("Enter the similarity threshold (0.0 to 1.0): ")
    );
    const intervalPeriod = parseInt(
      await askQuestion("Enter the interval period in milliseconds: ")
    );

    config = {
      initialRect,
      colorStates,
      similarityThreshold,
      intervalPeriod,
    };

    const configFileName = await askQuestion("Enter the name of the configuration file to save: ");
    await saveConfig(config, configFileName.trim());
  }

  const { topLeft, bottomRight } = config.initialRect;

  setInterval(async () => {
    const currentPixels = await getRectanglePixels(topLeft, bottomRight);
    let matched = false;

    for (const state of config.colorStates) {
      const similarity = calculateSimilarity(state, currentPixels);
      console.log(`🔍 Current similarity: ${(similarity * 100).toFixed(2)}%`);

      if (similarity >= config.similarityThreshold) {
        console.log("✅ Similarity threshold met! Performing action...");

        const midPoint: Point = {
          x: Math.floor((topLeft.x + bottomRight.x) / 2),
          y: Math.floor((topLeft.y + bottomRight.y) / 2),
        };

        const originalPosition = await getMousePosition();
        await clickAt(midPoint.x, midPoint.y);
        console.log(`🖱️ Clicked at (${midPoint.x}, ${midPoint.y})`);

        await moveCursorTo(originalPosition.x, originalPosition.y);
        console.log(`🔄 Returned cursor to original position (${originalPosition.x}, ${originalPosition.y})`);

        matched = true;
        break;
      }
    }

    if (!matched) {
      console.log("❌ No matching color state found.");
    }
  }, config.intervalPeriod);
})();
