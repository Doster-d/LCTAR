import React, { useState } from 'react';
import './LandingPageTemplate.css'; // Assuming we create a CSS file for styles

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
      ctaButton: "Back to AR"
    },
    ru: {
      title: "Решение AR-кейса",
      description: "Введите ваше описание здесь. Это плейсхолдер для текста описания.",
      techStack: "Технологический стек",
      advantages: "Преимущества",
      developmentTeam: "Команда разработчиков",
      ctaButton: "Вернуться к AR"
    }
  };

  const t = translations[lang];

  return (
    <div className={`landing-page ${theme === 'dark' ? 'dark-theme' : ''}`}>
      <div className="controls">
        <button onClick={toggleTheme}>{theme === 'light' ? 'Dark' : 'Light'}</button>
        <button onClick={toggleLang}>{lang === 'en' ? 'EN' : 'РУС'}</button>
      </div>
      {/* 1. General Information - Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <img src="/k1.png" alt="Logo" className="logo"/>
          <h1>{t.title}</h1>
          <p>{t.description}</p>
        </div>
      </section>

      {/* 2. Tech Stack - Grid of tech icons/logos */}
      <section className="tech-stack">
        <h2>{t.techStack}</h2>
        <div className="tech-grid">
          {[
            { icon: 'path/to/tech-icon1.jpg', name: 'React' },
            { icon: 'path/to/tech-icon2.jpg', name: 'Three.js' },
            { icon: 'path/to/tech-icon3.jpg', name: 'FastAPI' },
            { icon: 'path/to/tech-icon4.jpg', name: 'AprilTags' },
            { icon: 'path/to/tech-icon5.jpg', name: 'Blender' },
            { icon: 'path/to/tech-icon6.jpg', name: 'PostgreSQL' }
          ].map((tech, index) => (
            <div key={index} className="tech-item">
              <img src={tech.icon} alt={tech.name} />
              <p>{tech.name}</p>
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
            { photo: 'path/to/photo1.jpg', name: 'Name 1', role: 'Role 1', techStack: 'Tech Stack 1' },
            { photo: 'path/to/photo2.jpg', name: 'Name 2', role: 'Role 2', techStack: 'Tech Stack 2' },
            { photo: 'path/to/photo3.jpg', name: 'Name 3', role: 'Role 3', techStack: 'Tech Stack 3' },
            { photo: 'path/to/photo4.jpg', name: 'Name 4', role: 'Role 4', techStack: 'Tech Stack 4' },
            { photo: 'path/to/photo5.jpg', name: 'Name 5', role: 'Role 5', techStack: 'Tech Stack 5' }
          ].map((member, index) => (
            <div key={index} className="team-member">
              <img src={member.photo} alt={member.name} />
              <h3>{member.name}</h3>
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