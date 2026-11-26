const windowWidth = window.innerWidth;
const numberList = document.querySelectorAll(".number");
const emailList = document.querySelectorAll(".mail");
const numberListCopy = [...numberList];
const emailListCopy = [...emailList];

const contactDetails = [
  { number: "[TODO]", email: "[TODO]" },
  { number: "[TODO]", email: "[TODO]" },
  { number: "[TODO]", email: "[TODO]" },
  { number: "[TODO]", email: "[TODO]" },
];

setInterval(() => {
  if (window.innerWidth < 1201) {
    numberList.forEach((element) => {
      element.innerHTML = `<i class="fa-solid fa-phone"></i>`;
    });
    emailList.forEach((phone) => {
      phone.innerHTML = `<i class="fa-solid fa-envelope"></i>`;
    });
  } else {
    numberList.forEach((element, index) => {
      element.innerHTML = contactDetails[index].number;
    });
    emailList.forEach((phone, index) => {
      phone.innerHTML = contactDetails[index].email;
    });
  }
  // else{
  //     numberList.forEach((element)=>{
  //         element.innerHTML=numberListCopy.
  //     })
  // }
  //   console.log("recheck");
}, 50);

window.addEventListener("load", () => {});
console.log(numberList);

// window.addEventListener("resize", () => {
//   if (windowWidth < 1201) {
//     numberList.forEach((element) => {
//       element.innerHTML = `<i class="fa-solid fa-phone"></i>`;
//     });
//     emailList.forEach((phone) => {
//       phone.innerHTML = `<i class="fa-solid fa-envelope"></i>`;
//     });
//   }
//   console.log("resize");
// });
