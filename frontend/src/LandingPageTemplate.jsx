import React, { useState } from 'react';
import './LandingPageTemplate.css';

/**
 * @brief Маркетинговый лендинг с локализацией и призывом к действию.
 * @param onSwitchToApp Обработчик перехода в AR-приложение.
 * @returns {JSX.Element} Разметка посадочной страницы.
 */
const LandingPageTemplate = ({ onSwitchToApp, onOpenEditor }) => {
  const [theme, setTheme] = useState('light');
  const [lang, setLang] = useState('en');

  /**
   * @brief Переключает светлую и тёмную тему.
   * @returns {void}
   */
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  /**
   * @brief Переключает язык интерфейса между EN и RU.
   * @returns {void}
   */
  const toggleLang = () => setLang(lang === 'en' ? 'ru' : 'en');

  const translations = {
    en: {
      hero: {
        title: "AR-case solution",
        description: "Enter your description here. This is a placeholder for the description text."
      },
      techStack: {
        title: "Tech Stack",
        items: {
          react: "Frontend framework for building user interfaces",
          threejs: "3D graphics library for web applications",
          django: "Modern web framework for building APIs",
          apriltags: "Computer vision library for AR markers",
          blender: "3D modeling and animation software",
          postgresql: "Advanced open source relational database"
        }
      },
      advantages: {
        title: "Advantages",
        items: [
          { title: "Innovative Technologies", description: "Cutting-edge AR solutions with advanced computer vision and 3D graphics capabilities." },
          { title: "High Performance", description: "Optimized for real-time processing with minimal latency for seamless user experience." },
          { title: "User-Friendly Interface", description: "Intuitive design that makes complex AR technology accessible to all users." },
          { title: "Reliable Support", description: "Comprehensive technical support and regular updates to ensure optimal performance." }
        ]
      },
      team: {
        title: "Development Team",
        roster: ["Vagulich Alexander", "Alekseev Dmitriy", "Gorbunov Andrey", "Akhmedov Rinat", "Pashkova Arina"],
        roles: ["Frontend Developer", "Full Stack Developer", "3D Designer", "Backend Developer", "DevOps Engineer"],
        techStacks: ["React, TypeScript", "React, Node.js, Python", "Blender, 3D Modeling", "FastAPI, Python", "Docker, Kubernetes"]
      },
      stakeholders: {
        title: "You",
        description: "Customer focus is based on a sincere desire to make you happy and purr with pleasure"
      },
      cta: {
        buttonText: "Back to AR",
        editorButtonText: "AprilTag layout editor"
      }
    },
    ru: {
      hero: {
        title: "Решение AR-кейса",
        description: "Введите ваше описание здесь. Это плейсхолдер для текста описания."
      },
      techStack: {
        title: "Технологический стек",
        items: {
          react: "Фреймворк для создания пользовательских интерфейсов",
          threejs: "Библиотека 3D графики для веб-приложений",
          django: "Современный веб-фреймворк для создания API",
          apriltags: "Библиотека компьютерного зрения для AR-маркеров",
          blender: "Программное обеспечение для 3D-моделирования и анимации",
          postgresql: "Продвинутая реляционная база данных с открытым исходным кодом"
        }
      },
      advantages: {
        title: "Преимущества",
        items: [
          { title: "Инновационные технологии", description: "Современные AR-решения с передовыми возможностями компьютерного зрения и 3D-графики." },
          { title: "Высокая производительность", description: "Оптимизировано для обработки в реальном времени с минимальной задержкой для бесперебойной работы." },
          { title: "Удобный интерфейс", description: "Интуитивный дизайн, делающий сложную AR-технологию доступной для всех пользователей." },
          { title: "Надежная поддержка", description: "Комплексная техническая поддержка и регулярные обновления для обеспечения оптимальной работы." }
        ]
      },
      team: {
        title: "Команда разработчиков",
        roster: ["Вагулич Александр", "Алексеев Дмитрий", "Горбунов Андрей", "Ахмедов Ринат", "Пашкова Арина"],
        roles: ["Frontend-разработчик", "Full Stack-разработчик", "3D-дизайнер", "Backend-разработчик", "DevOps-инженер"],
        techStacks: ["React, TypeScript", "React, Node.js, Python", "Blender, 3D-моделирование", "FastAPI, Python", "Docker, Kubernetes"]
      },
      stakeholders: {
        title: "Вы",
        description: "Клиентоориентированность строится на искреннем желании сделать вас счастливыми и мурчащими от удовольствия"
      },
      cta: {
        buttonText: "Вернуться к AR",
        editorButtonText: "Редактор макета AprilTag"
      }
    }
  };

  const t = translations[lang];

  return (
    <div className={`landing-page ${theme === 'dark' ? 'dark-theme' : ''}`}>
      <div className="controls">
        {/* <button onClick={toggleTheme}>{theme === 'light' ? 'Dark' : 'Light'}</button> */}
        <button onClick={toggleLang} className="language-button">
          {lang === 'en' ? 'EN' : 'RU'}
        </button>
      </div>
      {/* 1. General Information - Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <img src="./img/k1.png" alt="Logo" className="logo"/>
          <h1>{t.hero.title}</h1>
          <p>{t.hero.description}</p>
        </div>
      </section>

      {/* 2. Tech Stack - Grid of tech icons/logos */}
      <section className="tech-stack">
        <h2>{t.techStack.title}</h2>
        <div className="tech-grid">
          {[
            { icon: './img/stack/react.png', name: 'React', description: t.techStack.items.react },
            { icon: './img/stack/three-js.png', name: 'Three.js', description: t.techStack.items.threejs },
            { icon: './img/stack/django.png', name: 'FastAPI', description: t.techStack.items.django },
            { icon: './img/stack/AT.svg', name: 'AprilTags', description: t.techStack.items.apriltags },
            { icon: './img/stack/blender.png', name: 'Blender', description: t.techStack.items.blender },
            { icon: './img/stack/postgre.png', name: 'PostgreSQL', description: t.techStack.items.postgresql }
          ].map((tech, index) => (
            <div key={index} className="tech-item">
              <img src={tech.icon} alt={tech.name} />
              <h4>{tech.name}</h4>
              <p className="tech-description">{tech.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Advantages - List or cards of key benefits */}
      <section className="advantages">
        <h2>{t.advantages.title}</h2>
        <div className="advantages-grid">
          {t.advantages.items.map((advantage, index) => (
            <div key={index} className="advantage-card">
              <h3>{advantage.title}</h3>
              <p>{advantage.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Development Team - Grid of 5 team member cards */}
      <section className="team">
        <h2>{t.team.title}</h2>
        <div className="team-grid">
          {[
            { photo: './img/team/ch1ll.jpg', name: t.team.roster[0], role: t.team.roles[0], techStack: t.team.techStacks[0] },
            { photo: './img/team/doster.jpg', name: t.team.roster[1], role: t.team.roles[1], techStack: t.team.techStacks[1] },
            { photo: './img/team/cookie.jpg', name: t.team.roster[2], role: t.team.roles[2], techStack: t.team.techStacks[2] },
            { photo: './img/team/rina.png', name: t.team.roster[3], role: t.team.roles[3], techStack: t.team.techStacks[3] },
            { photo: './img/team/arina.jpg', name: t.team.roster[4], role: t.team.roles[4], techStack: t.team.techStacks[4] },
            { photo: './img/team/ppl.jpg', name: t.stakeholders.title, role: t.stakeholders.description }
          ].map((member, index) => (
            <div key={index} className="team-member">
              <img src={member.photo} alt={member.name} />
              <h3>{member.name.split(' ').map((part, i) => (
                <div key={i}>{part}</div>
              ))}</h3>
              <p>{member.role}</p>
              <p>{member.techStack}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Call-to-Action */}
      <section className="cta">
        <div className="cta-buttons">
          <button
            type="button"
            aria-label={t.cta.buttonText}
            className="cta-button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSwitchToApp && onSwitchToApp();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSwitchToApp && onSwitchToApp();
              }
            }}
            style={{
              pointerEvents: 'auto'
            }}
          >
            {t.cta.buttonText}
          </button>
          <button
            type="button"
            aria-label={t.cta.editorButtonText}
            className="cta-button secondary"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenEditor && onOpenEditor();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenEditor && onOpenEditor();
              }
            }}
            style={{
              pointerEvents: 'auto'
            }}
          >
            {t.cta.editorButtonText}
          </button>
        </div>
      </section>
    </div>
  );
};

export default LandingPageTemplate;