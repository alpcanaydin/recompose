function App(): React.JSX.Element {
  return (
    <div className="flex h-full">
      <aside className="app-drag w-60 bg-surface-sidebar px-4 pt-13 pb-4 text-body text-ink-secondary">
        Sidebar
      </aside>
      <main className="bg-surface-content px-6 pt-13 pb-6 text-body flex-1">Main Area</main>
    </div>
  );
}

export default App;
