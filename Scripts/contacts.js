const numberList = document.querySelectorAll(".number");

const contactDetails = [
  { number: "+91 70707 57533", pending: false },
  { number: "Number pending confirmation", pending: true },
  { number: "+91 91997 22066", pending: false },
  { number: "8862937210", pending: false },
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
      element.innerHTML = `<i class="fa-solid fa-phone" aria-hidden="true"></i>`;
    } else {
      element.textContent = info.number;
    }
  });
};

renderContacts();
window.addEventListener("resize", renderContacts, { passive: true });
