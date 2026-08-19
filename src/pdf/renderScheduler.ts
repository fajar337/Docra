type RenderTask = () => void

const renderTasks = new Map<symbol, RenderTask>()
let animationFrameId: number | null = null

function scheduleNextFrame() {
  if (animationFrameId !== null || renderTasks.size === 0) {
    return
  }

  animationFrameId = window.requestAnimationFrame(() => {
    animationFrameId = null

    const nextTask = renderTasks.entries().next()
    if (nextTask.done) {
      return
    }

    const [key, task] = nextTask.value
    renderTasks.delete(key)
    try {
      task()
    } finally {
      scheduleNextFrame()
    }
  })
}

export function schedulePDFRender(key: symbol, task: RenderTask) {
  renderTasks.set(key, task)
  scheduleNextFrame()

  return () => {
    if (renderTasks.get(key) === task) {
      renderTasks.delete(key)
    }
  }
}
