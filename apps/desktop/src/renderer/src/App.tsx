import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'

const handleSendIpc = (): void => {
  window.electron.ipcRenderer.send('ping')
}

function App(): React.JSX.Element {
  return (
    <>
      <img alt="logo" className="logo" src={electronLogo} />
      <div className="creator">Powered by electron-vite</div>
      <div className="text">
        Build an Electron app with <span className="react">React</span>
        &nbsp;and <span className="ts">TypeScript</span>
      </div>
      <p className="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>
      <div className="actions">
        <div className="action">
          <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
        <div className="action">
          <button type="button" onClick={handleSendIpc}>
            Send IPC
          </button>
        </div>
      </div>
      <Versions />
    </>
  )
}

export default App
