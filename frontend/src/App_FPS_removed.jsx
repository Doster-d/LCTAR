// Временный файл для удаления FPS блока
// Найти строку с Microphone и Recording Controls Group

// Микрофон (СОХРАНИТЬ):
          <div style={{
            display: "flex",
            flexDirection: "column", 
            alignItems: "center",
            gap: "8px"
          }}>
            <h4>Аудио</h4>
            <label>
              <input type="checkbox" checked={withMic} onChange={(e) => setWithMic(e.target.checked)} />
              <span>Microphone</span>
            </label>
          </div>

// FPS блок (УДАЛИТЬ ВЕСЬ!)

// Запись (СОХРАНИТЬ):
          {/* Recording Controls Group */}
          <div style={{
            display: "flex", 
            flexDirection: "column",
            alignItems: "center",
            gap: "8px"
          }}>
            <h4>Запись</h4>
            // ... кнопки Record/Stop
          </div>
