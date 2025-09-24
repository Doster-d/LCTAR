import React, { useState } from 'react';
import './LandingPageTemplate.css';

const LandingPageTemplate = () => {
  const [theme, setTheme] = useState('light');
  const [lang, setLang] = useState('en');

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const toggleLang = () => setLang(lang === 'en' ? 'ru' : 'en');

  const translations = {
    en: {
      title: "AR-case solution",
      description: "Enter your description here. This is a placeholder for the description text.",
      techStack: "Tech Stack",
      advantages: "Advantages",
      developmentTeam: "Development Team",
      developmentTeamRoster: ["Vagulich Alexander", "Alexeev Dmitriy", "Gorbunov Andrey", "Akhmedov Rinat", "Pashkova Arina"],
      stakeholderText: ["Stakeholders", "Customer focus is based on a sincere desire to make you happy and purr with pleasure"],
      ctaButton: "Back to AR"
    },
    ru: {
      title: "Решение AR-кейса",
      description: "Введите ваше описание здесь. Это плейсхолдер для текста описания.",
      techStack: "Технологический стек",
      advantages: "Преимущества",
      developmentTeam: "Команда разработчиков",
      developmentTeamRoster: ["Вагулич Александр", "Алексеев Дмитрий", "Горбунов Андрей", "Ахмедов Ринат", "Пашкова Арина"],
      stakeholderText: ["Стейкхолдеры", "Клиентоориентированность строится на искреннем желании сделать вас счастливыми и мурчащими от удовольствия"],
      ctaButton: "Вернуться к AR"
    }
  };

  const t = translations[lang];

  return (
    <div className={`landing-page ${theme === 'dark' ? 'dark-theme' : ''}`}>
      <div className="controls">
        <button onClick={toggleTheme}>{theme === 'light' ? 'Dark' : 'Light'}</button>
        <button onClick={toggleLang} className="language-button">
          {lang === 'en' ? 'EN' : 'RU'}
        </button>
      </div>
      {/* 1. General Information - Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <img src="./img/k1.png" alt="Logo" className="logo"/>
          <h1>{t.title}</h1>
          <p>{t.description}</p>
        </div>
      </section>

      {/* 2. Tech Stack - Grid of tech icons/logos */}
      <section className="tech-stack">
        <h2>{t.techStack}</h2>
        <div className="tech-grid">
          {[
            { icon: './img/stack/react.png', name: 'React', description: 'Frontend framework for building user interfaces' },
            { icon: './img/stack/three-js.png', name: 'Three.js', description: '3D graphics library for web applications' },
            { icon: './img/stack/fastapi.png', name: 'FastAPI', description: 'Modern web framework for building APIs' },
            { icon: 'path/to/tech-icon4.jpg', name: 'AprilTags', description: 'Computer vision library for AR markers' },
            { icon: './img/stack/blender.png', name: 'Blender', description: '3D modeling and animation software' },
            { icon: './img/stack/postgre.png', name: 'PostgreSQL', description: 'Advanced open source relational database' }
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
        <h2>{t.advantages}</h2>
        <div className="advantages-grid">
          {[
            { title: 'Benefit Title 1', description: 'Description of the benefit 1.' },
            { title: 'Benefit Title 2', description: 'Description of the benefit 2.' },
            { title: 'Benefit Title 3', description: 'Description of the benefit 3.' },
            { title: 'Benefit Title 4', description: 'Description of the benefit 4.' }
          ].map((advantage, index) => (
            <div key={index} className="advantage-card">
              <h3>{advantage.title}</h3>
              <p>{advantage.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Development Team - Grid of 5 team member cards */}
      <section className="team">
        <h2>{t.developmentTeam}</h2>
        <div className="team-grid">
          {[
            { photo: './img/team/ch1ll.jpg', name: t.developmentTeamRoster[0], role: 'Role 1', techStack: 'Tech Stack 1' },
            { photo: './img/team/doster.jpg', name: t.developmentTeamRoster[1], role: 'Fullstack', techStack: 'Tech Stack 2' },
            { photo: './img/team/cookie.jpg', name: t.developmentTeamRoster[2], role: '3D-Design', techStack: 'Blender' },
            { photo: './img/team/rina.jpg', name: t.developmentTeamRoster[3], role: 'Backend', techStack: 'FastAPI' },
            { photo: './img/team/arina.jpg', name: t.developmentTeamRoster[4], role: 'DevOps', techStack: 'Dockeer' },
            { photo: './img/team/ppl.jpg', name: t.stakeholderText[0], role: t.stakeholderText[1] }
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

      {/* 5. Call-to-Action Button */}
      <section className="cta">
        <button className="cta-button">
          {t.ctaButton}
        </button>
      </section>
    </div>
  );
};

export default LandingPageTemplate;