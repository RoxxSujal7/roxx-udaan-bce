const numberList = document.querySelectorAll(".number");

const contactDetails = [
  { number: "+91 70707 57533", pending: false },
  { number: "+91 70917 99059", pending: false },
  { number: "+91 91997 22066", pending: false },
  { number: "+91 88629 37210", pending: false },
];

const renderContacts = () => {
  const isCompact = window.innerWidth < 1201;
  numberList.forEach((element, index) => {
    const info = contactDetails[index];
    if (!info) return;
    if (info.pending) {
      element.textContent = isCompact ? "Pending" : info.number;
      return;
    }
    if (isCompact) {
      element.innerHTML = `<svg aria-hidden="true" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" style="display:inline-block;vertical-align:-0.125em"><path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z"/></svg>`;
    } else {
      element.textContent = info.number;
    }
  });
};

renderContacts();
window.addEventListener("resize", renderContacts, { passive: true });
