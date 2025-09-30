import { useEffect } from 'react';

/**
 * @brief Генерирует уникальный промокод.
 * @returns {string} Промокод в формате XXXX-XXXX.
 */
export const generatePromoCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const part1 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part1}-${part2}`;
};

/**
 * @brief Компонент всплывающего окна с промокодом.
 * @param isVisible Видимость окна.
 * @param promoCode Промокод для отображения.
 * @param onClose Функция закрытия окна.
 * @param score Количество очков игрока.
 * @returns {JSX.Element|null} Компонент всплывающего окна.
 */
const PromoPopup = ({ isVisible, promoCode, onClose, score }) => {
  if (!isVisible) return null;

  // Закрытие по клавише Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isVisible, onClose]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(promoCode);
      // Временно меняем текст кнопки для обратной связи
      const button = document.querySelector('[data-copy-button]');
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ Скопировано!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error('Ошибка копирования промокода:', err);
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = promoCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.3s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px',
        padding: '40px',
        textAlign: 'center',
        color: 'white',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        animation: 'slideInScale 0.4s ease-out',
        position: 'relative'
      }}>
        {/* Кнопка закрытия в углу */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            color: 'white',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.3)';
            e.target.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)';
            e.target.style.transform = 'scale(1)';
          }}
        >
          ✕
        </button>

        {/* Анимированные конфетти */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          fontSize: '20px',
          animation: 'bounce 2s ease-in-out infinite'
        }}>🎊</div>
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '50px',
          fontSize: '16px',
          animation: 'bounce 2s ease-in-out infinite 0.5s'
        }}>✨</div>
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '30px',
          fontSize: '18px',
          animation: 'bounce 2s ease-in-out infinite 1s'
        }}>🎉</div>
        
        <div style={{
          fontSize: '60px',
          marginBottom: '20px',
          animation: 'pulse 2s ease-in-out infinite'
        }}>🏆</div>
        
        <h2 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          margin: '0 0 10px 0',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
        }}>
          Поздравляем!
        </h2>
        
        <p style={{
          fontSize: '16px',
          margin: '0 0 20px 0',
          opacity: 0.9
        }}>
          Вы набрали максимальное количество очков: <strong>{score}</strong>
        </p>
        
        <div style={{
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '15px',
          padding: '20px',
          margin: '20px 0',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          backdropFilter: 'blur(5px)'
        }}>
          <p style={{
            fontSize: '14px',
            margin: '0 0 10px 0',
            opacity: 0.8
          }}>
            Ваш промокод:
          </p>
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            letterSpacing: '3px',
            margin: '10px 0',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            {promoCode}
          </div>
          <button
            data-copy-button
            onClick={copyToClipboard}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '25px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '10px',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              margin: '10px auto 0'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.3)';
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 5px 15px rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            📋 Копировать промокод
          </button>
        </div>
        
        <p style={{
          fontSize: '12px',
          opacity: 0.7,
          margin: '20px 0 0 0'
        }}>
          Используйте этот промокод для получения скидки!
        </p>
      </div>

      {/* CSS анимации */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideInScale {
          from {
            opacity: 0;
            transform: translateY(-50px) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
};

export default PromoPopup;
