/** Expands each standalone `/slur` token before OpenCode submits the prompt. */
export const Slur = async () => ({
  "chat.message": async (_input, output) => {
    for (const part of output.parts) {
      if (part.type !== "text" || !part.text.includes("/slur")) continue

      const process = Bun.spawn(["slur", "expand", part.text], {
        stdout: "pipe",
        stderr: "pipe",
      })
      const [expanded, error, exitCode] = await Promise.all([
        new Response(process.stdout).text(),
        new Response(process.stderr).text(),
        process.exited,
      ])

      if (exitCode !== 0) {
        throw new Error(error.trim() || `slur exited with status ${exitCode}`)
      }
      part.text = expanded
    }
  },
})
