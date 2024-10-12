import { $ } from "bun";

type Point = { x: number; y: number };

// Function to get the current mouse position using PowerShell
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

// Function to get all pixel colors in a rectangle area using PowerShell
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

  // Ensure the result is a two-dimensional array of strings
  return parsedResult.map((row: { value: string[] }) => row.value);
}

// Function to click at given coordinates using PowerShell
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

// Function to move the cursor to given coordinates without clicking
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

// Function to calculate similarity between two rectangles
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

  const maxDifference = totalPixels * 255 * 3; // Max possible difference (255 per channel)
  return 1 - (totalDifference / maxDifference); // Return similarity as a percentage
}

// Convert hex color to RGB and calculate difference
function calculateColorDifference(color1: string, color2: string): number {
  const r1 = parseInt(color1.slice(0, 2), 16);
  const g1 = parseInt(color1.slice(2, 4), 16);
  const b1 = parseInt(color1.slice(4, 6), 16);
  const r2 = parseInt(color2.slice(0, 2), 16);
  const g2 = parseInt(color2.slice(2, 4), 16);
  const b2 = parseInt(color2.slice(4, 6), 16);

  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

(async () => {
  console.log("🚀 Starting the advanced area monitoring script...");

  console.log("🖱️ Please place the cursor over the first corner of the target area...");
  await new Promise(res => setTimeout(res, 5000)); // Wait for 5 seconds

  const firstCorner = await getMousePosition();
  console.log(`📌 First corner captured at X: ${firstCorner.x}, Y: ${firstCorner.y}`);

  console.log("🖱️ Now place the cursor over the opposite corner of the target area...");
  await new Promise(res => setTimeout(res, 5000)); // Wait for 5 seconds

  const secondCorner = await getMousePosition();
  console.log(`📌 Second corner captured at X: ${secondCorner.x}, Y: ${secondCorner.y}`);

  console.log("🖱️ Move the cursor away from the target area...");
  await new Promise(res => setTimeout(res, 5000)); // Additional wait time to move cursor

  // Determine top-left and bottom-right points
  const topLeft: Point = {
    x: Math.min(firstCorner.x, secondCorner.x),
    y: Math.min(firstCorner.y, secondCorner.y),
  };
  const bottomRight: Point = {
    x: Math.max(firstCorner.x, secondCorner.x),
    y: Math.max(firstCorner.y, secondCorner.y),
  };

  console.log(`📏 Monitoring rectangle defined from (${topLeft.x}, ${topLeft.y}) to (${bottomRight.x}, ${bottomRight.y})`);

  const pixelCaptureStartTime = performance.now();
  const initialPixels = await getRectanglePixels(topLeft, bottomRight);
  const pixelCaptureEndTime = performance.now();
  console.log(`🎨 Initial pixel colors captured in ${(pixelCaptureEndTime - pixelCaptureStartTime).toFixed(2)} ms`);

  setInterval(async () => {
    const pixelCaptureStart = performance.now();
    const currentPixels = await getRectanglePixels(topLeft, bottomRight);
    const pixelCaptureEnd = performance.now();
    console.log(`⏱️ Time to capture current pixels: ${(pixelCaptureEnd - pixelCaptureStart).toFixed(2)} ms`);

    const similarityCalcStart = performance.now();
    const similarity = calculateSimilarity(initialPixels, currentPixels);
    const similarityCalcEnd = performance.now();
    console.log(`⏱️ Time to calculate similarity: ${(similarityCalcEnd - similarityCalcStart).toFixed(2)} ms`);

    console.log(`🔍 Current similarity: ${(similarity * 100).toFixed(2)}%`);

    if (similarity > 0.9) { // For example, trigger if similarity is above 90%
      console.log("✅ Similarity threshold met! Performing action...");

      const midPoint: Point = {
        x: Math.floor((topLeft.x + bottomRight.x) / 2),
        y: Math.floor((topLeft.y + bottomRight.y) / 2),
      };

      const originalPosition = await getMousePosition();
      await clickAt(midPoint.x, midPoint.y);
      console.log(`🖱️ Clicked at (${midPoint.x}, ${midPoint.y})`);

      // Return cursor to original position without clicking
      await moveCursorTo(originalPosition.x, originalPosition.y);
      console.log(`🔄 Returned cursor to original position (${originalPosition.x}, ${originalPosition.y})`);
    } else {
      console.log("❌ Similarity below threshold. No action taken.");
    }
  }, 20000); // 20 seconds
})();
