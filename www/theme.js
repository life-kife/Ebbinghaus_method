// Темы оформления: 8 цветовых схем, у каждой светлый и тёмный вариант.
(() => {
  const P = {
    A: { name: 'Синий', light: ['#eef0f3', '#ffffff', '#e5e8ee', '#1b2130', '#636c7c', '#d8dce4', '#2f47c4', '#ffffff', '#e4e9fb'], dark: ['#12151c', '#1b1f29', '#161a22', '#e8eaef', '#9aa2b2', '#2c3241', '#8ea0ff', '#10142a', '#232a48'] },
    B: { name: 'Изумруд', light: ['#edf2f0', '#ffffff', '#e1e9e5', '#15211d', '#5c6b65', '#d3dfd9', '#0d7a5f', '#ffffff', '#dcf0e8'], dark: ['#0f1714', '#16201c', '#121b18', '#e5ece9', '#93a39c', '#24332d', '#4fd1a5', '#06261c', '#173a2f'] },
    C: { name: 'Фиолет', light: ['#f1eff6', '#ffffff', '#e7e3f0', '#1d1830', '#69627c', '#ddd7ea', '#5b3fd1', '#ffffff', '#ebe5fc'], dark: ['#14111d', '#1d1928', '#181421', '#ebe8f3', '#a49db6', '#2f2940', '#ab95ff', '#1a1036', '#2c2450'] },
    D: { name: 'Океан', light: ['#eaf1f4', '#ffffff', '#dde8ed', '#132029', '#5a6a74', '#d0dfe6', '#0a6e8f', '#ffffff', '#d9eef5'], dark: ['#0d161b', '#142028', '#101a20', '#e3edf1', '#91a4ad', '#22333d', '#5cc6e8', '#04212c', '#163745'] },
    E: { name: 'Вишня', light: ['#f5efed', '#ffffff', '#ede4e1', '#2a1a1c', '#76625f', '#e6d9d5', '#b4234f', '#ffffff', '#fae3ea'], dark: ['#1a1214', '#24191c', '#1e1517', '#f1e8e9', '#b19fa1', '#3a2a2e', '#ff7fa3', '#3a0717', '#4a1d2b'] },
    F: { name: 'Графит', light: ['#ececea', '#fafaf8', '#e2e2df', '#191a1c', '#64666b', '#d6d6d2', '#1f2023', '#fafaf8', '#deded9'], dark: ['#111213', '#1a1b1d', '#151617', '#ececea', '#9c9ea3', '#2a2c2f', '#ececea', '#111213', '#2c2e31'] },
    G: { name: 'Янтарь', light: ['#f2efe9', '#ffffff', '#e9e3d8', '#241c10', '#6f6553', '#e3dccf', '#b05f00', '#ffffff', '#fbecd3'], dark: ['#17130d', '#211b13', '#1b160f', '#f0ebe2', '#aba08d', '#352c1f', '#f2b04f', '#2a1a00', '#3d2c10'] },
    H: { name: 'Сумерки', light: ['#eceff3', '#ffffff', '#e1e6ec', '#1a2230', '#5f6878', '#d5dce5', '#3d5a80', '#ffffff', '#dfe7f1'], dark: ['#11161d', '#19202a', '#141a22', '#e6eaf0', '#98a3b3', '#29323f', '#98b6dc', '#0d1a2b', '#223146'] },
  };
  const KEYS = ['--bg', '--surface', '--sunken', '--ink', '--muted', '--line', '--accent', '--accent-ink', '--accent-soft'];
  const SEM = {
    light: { '--again': '#c2412d', '--again-soft': '#fbe9e5', '--hard': '#a86d0b', '--hard-soft': '#fbf1dc', '--good': '#2f8a4e', '--good-soft': '#e2f3e7',
      '--c0': '#2f47c4', '--c1': '#2f8a4e', '--c2': '#c0561c', '--c3': '#7a3fb0', '--c4': '#0f7e8c', '--c5': '#c2364a', '--c6': '#8a7600', '--c7': '#55607a',
      '--shadow': '0 14px 34px -22px rgba(20,30,70,.45)' },
    dark: { '--again': '#f08470', '--again-soft': '#3a201d', '--hard': '#e6b257', '--hard-soft': '#372b16', '--good': '#62c586', '--good-soft': '#1b3324',
      '--c0': '#8ea0ff', '--c1': '#62c586', '--c2': '#f0a070', '--c3': '#c49af0', '--c4': '#5ccbd8', '--c5': '#f07f8f', '--c6': '#d9c84a', '--c7': '#a5afc4',
      '--shadow': '0 14px 34px -22px rgba(0,0,0,.8)' },
  };
  const mq = matchMedia('(prefers-color-scheme: dark)');
  let cur = { pal: 'A', mode: 'system' };
  const isDark = () => cur.mode === 'dark' || (cur.mode === 'system' && mq.matches);
  function apply(pal, mode, onChange) {
    if (pal) cur.pal = P[pal] ? pal : 'A';
    if (mode) cur.mode = mode;
    const dark = isDark(), vals = P[cur.pal][dark ? 'dark' : 'light'], st = document.documentElement.style;
    KEYS.forEach((k, i) => st.setProperty(k, vals[i]));
    Object.entries(SEM[dark ? 'dark' : 'light']).forEach(([k, v]) => st.setProperty(k, v));
    st.setProperty('color-scheme', dark ? 'dark' : 'light');
    if (onChange) onChange({ dark, bg: vals[0] });
  }
  window.THEME = { P, apply, isDark, current: () => ({ ...cur }), onSystemChange: fn => mq.addEventListener('change', fn) };
})();
