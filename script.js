const ELEMENTS = {
  $searchForm: $(".search-form"),
  $bookingForm: $(".booking-form"),
  $checkInDateInput: $(".check-in-date-input"),
  $checkOutDateInput: $(".check-out-date-input"),
  $citiesSelect: $(".cities-select"),
  $lodaingSpinner: $(".loading-spinner"),
  $results: $(".results"),
};

const state = {
  // dynamically state is gonna have the following keys:
  // ACCESS_TOKEN, offerId, hotelId
};

main();

function main() {
  createAccessToken();
  createCityOptions();
  setEarliestCheckInDate();
  setEarliestCheckOutDate();
  initSearchForm();
  initBookingForm();
}

function initSearchForm() {
  ELEMENTS.$searchForm.on("submit", (e) => {
    e.preventDefault();

    const searchDetails = {
      $city: $(e.target.cityInput).val(),
      $checkInDate: $(e.target.checkInDate).val(),
      $checkOutDate: $(e.target.checkOutDate).val(),
    };

    ELEMENTS.$results.empty();

    createSearchingSpinner();

    createCheapestDealsResults(searchDetails);
  });
}

function setEarliestCheckInDate() {
  const now = luxon.DateTime.now().c;
  const currentYear = now.year;
  let currentMonth = now.month;
  let currentDay = now.day;

  currentDay < 10 ? (currentDay = `0${currentDay}`) : currentDay;
  currentMonth < 10 ? (currentMonth = `0${currentMonth}`) : currentMonth;

  ELEMENTS.$checkInDateInput.attr(
    "min",
    `${currentYear}-${currentMonth}-${currentDay}`
  );
}

function setEarliestCheckOutDate() {
  const DateTime = luxon.DateTime;
  ELEMENTS.$checkInDateInput.on("change", (e) => {
    const chosenDate = e.target.value;
    const dayAfterChosenDate = DateTime.fromISO(chosenDate)
      .plus({ days: 1 })
      .toISODate();
    ELEMENTS.$checkOutDateInput.attr("min", dayAfterChosenDate);
  });
}

async function createCityOptions() {
  const citiesObj = await $.ajax({
    url: "cities.json",
    method: "GET",
  });

  const cityKeys = Object.keys(citiesObj);
  cityKeys.forEach((key) => {
    const option = `<option value="${citiesObj[key]}">${key}</option>`;
    ELEMENTS.$citiesSelect.append(option);
  });
}

async function createAccessToken() {
  const accessTokenObj = await $.ajax({
    method: "POST",
    url: `https://test.api.amadeus.com/v1/security/oauth2/token`,
    data: {
      client_id: " hlPwn2Y3dZlFgOXU2HqUjiy2poLwE8cg",
      client_secret: "UPn6zLV0dNhIdFLi",
      grant_type: "client_credentials",
    },
  });

  state.ACCESS_TOKEN = accessTokenObj.access_token;
}

async function createCheapestDealsResults(searchDetails) {
  const city = searchDetails.$city;
  const checkInDate = searchDetails.$checkInDate;
  const checkOutDate = searchDetails.$checkOutDate;
  const cheapestDealsApiUrl = `https://test.api.amadeus.com/v2/shopping/hotel-offers?cityCode=${city}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}`;

  try {
    const cheapestDealsData = await $.ajax({
      url: cheapestDealsApiUrl,
      method: "GET",
      headers: {
        Authorization: `Bearer ${state.ACCESS_TOKEN}`,
      },
    });

    $(".loading-spinner").remove();
    if (cheapestDealsData.data.length === 0) {
      const noResults = $(`
                          <div class="no-results">No results...</div>
                      `);
      return ELEMENTS.$results.html(noResults);
    }
    cheapestDealsData.data.forEach((result) => {
      renderResult(result);
    });
  } catch (err) {
    $(".loading-spinner").remove();
    renderExpiredTokenError();
    setTimeout(() => {
      ELEMENTS.$results.empty();
    }, 3500);
  }
}

async function renderExpiredTokenError() {
  const expiredTokenAlert = $(`
      <div class="alert alert-warning d-flex align-items-center expired-alert" role="alert">
          <svg class="bi flex-shrink-0 me-2" width="24" height="24" role="img" aria-label="Warning:"><use xlink:href="#exclamation-triangle-fill"/></svg>
          <div>
              Access token expired, please reload the page.
          </div>
      </div>`);

  ELEMENTS.$results.append(expiredTokenAlert);
  return ELEMENTS.$results;
}

function initBookingForm() {
  ELEMENTS.$bookingForm.on("submit", async (e) => {
    e.preventDefault();

    const guestDetails = {
      $title: $(e.target.guestTitle).val(),
      $firstName: $(e.target.guestFirstName).val(),
      $lastName: $(e.target.guestLastName).val(),
      $phone: $(e.target.guestPhone).val(),
      $email: $(e.target.guestEmail).val(),
    };

    const fakePayments = [
      {
        method: "creditCard",
        card: {
          vendorCode: "VI",
          cardNumber: "4151289722471370",
          expiryDate: "2023-08",
        },
      },
    ];

    createBookingSpinner();

    try {
      const bookingResponse = await getBookingResponse(
        guestDetails,
        fakePayments
      );

      $("#guest-modal").modal("hide");
      const successAlert = $(`
                        <div class="alert alert-success d-flex align-items-center success-alert-msg" role="alert">
                            <svg class="bi flex-shrink-0 me-2" width="24" height="24" role="img" aria-label="Success:"><use xlink:href="#check-circle-fill"/></svg>
                            <div>
                                The room has been ordered successfully! order ID: ${bookingResponse.data[0].id}
                            </div>
                            <button type="button" class="btn-close success-close-btn" title="close" aria-label="Close"></button>
                        </div>
                        `);
      ELEMENTS.$results.html(successAlert);
      $(".success-close-btn").on("click", () =>
        $(".success-alert-msg").remove()
      );
    } catch (err) {
      if (
        err.responseJSON.errors[0].title === "The access token is expired" ||
        err.responseJSON.errors[0].code === 38192
      ) {
        $("#guest-modal").modal("hide");
        renderExpiredTokenError();
        setTimeout(() => {
          $(".expired-token").remove();
        }, 4000);
      } else {
        $("#guest-modal").modal("hide");
        const errorsAlert = $(`
                                  <div class="alert alert-warning d-flex align-items-center error-alert" role="alert">
                                      <svg class="bi flex-shrink-0 me-2" width="24" height="24" role="img" aria-label="Warning:"><use xlink:href="#exclamation-triangle-fill"/></svg>
                                      <div>
                                          This room isn't available right now, please choose another room or try again later.
                                      </div>
                                  </div>`);

        ELEMENTS.$results.append(errorsAlert);

        setTimeout(() => {
          $(".error-alert").remove();
        }, 5000);
      }
    }
  });
}

async function getBookingResponse(guestDetails, fakePayments) {
  const bookingResponse = await $.ajax({
    url: "https://test.api.amadeus.com/v1/booking/hotel-bookings",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.ACCESS_TOKEN}`,
    },
    data: JSON.stringify({
      data: {
        offerId: `${state.offerId}`,
        guests: [
          {
            name: {
              title: guestDetails.$title,
              firstName: guestDetails.$firstName,
              lastName: guestDetails.$lastName,
            },
            contact: {
              phone: guestDetails.$phone,
              email: guestDetails.$email,
            },
          },
        ],
        payments: fakePayments,
      },
    }),
  });

  return bookingResponse;
}

function renderResult(result) {
  const fullRatingStar = `<i class="fas fa-star"></i>`;
  const emptyRatingStar = `<i class="far fa-star"></i>`;
  const numberOfFullStars = Number(result.hotel.rating);
  const numberOfEmptyStars = 5 - numberOfFullStars;
  const ratingStarsLine = result.hotel.rating
    ? `${fullRatingStar.repeat(numberOfFullStars)}${emptyRatingStar.repeat(
        numberOfEmptyStars
      )}`
    : "not rated yet";

  const hotelAddress = result.hotel.address.lines[0];
  const hotelLatitude = result.hotel.latitude;
  const hotelLongitude = result.hotel.longitude;
  const hotelLocationUrl = `https://www.google.com/maps/place/${hotelLatitude}+${hotelLongitude}`;

  const hotelDescription = result.hotel.description
    ? result.hotel.description.text
    : "No hotel description yet";
  const roomDescription = result.offers[0].room.description.text;
  const totalPrice = result.offers[0].price.total;
  const currency =
    result.offers[0].price.currency === "GBP" || "gbp"
      ? "£"
      : result.offers[0].price.currency;
  const randomRoomImage = `https://source.unsplash.com/400x300/?hotel&${hotelAddress}`;

  const $result = $(`
      <div class="result row my-4 border border-2 rounded">
          <div class="col hotel-content m-4">
              <div>
                  <h1>${result.hotel.name}</h1>
                  <div class="rating">
                      ${ratingStarsLine}
                  </div>
                  <div class="address my-3">
                      <span class="fw-bold">address:</span> ${hotelAddress} <a id="jump-to-location" href="${hotelLocationUrl}" target="_blank"><i class="fas fa-map-marker-alt location-icon"></i></a>
                  </div>
                  <span></span>
                  <p class="hotel-description">${hotelDescription}</p>
              </div>
              <img class="my-3 img-thumbnail rounded mx-auto" src="${randomRoomImage}">
          </div>
          <hr>
          <div class="room-content col-4">
              <div class="room-description"><span class="room-description-title">Room Description:</span> ${roomDescription}</div>
              <div class="ordering">
                  <div class="price mb-2">${totalPrice} <span>${currency}</span></div>
                  <button type="button" class="btn btn-danger btn-lg mb-2 order-room-btn" data-bs-toggle="modal" data-bs-target="#guest-modal">ORDER ROOM</button>
                  <button type="button" class="btn btn-success btn-lg mb-4 show-all-rooms-btn">SHOW ALL ROOMS</button>
              </div>
          </div>
      </div>
      `);
  ELEMENTS.$results.append($result);

  $result.find(".order-room-btn").on("click", () => {
    if ($(".booking-spinner")) {
      $(".booking-spinner").remove();
    }

    const offerId = result.offers[0].id;
    state.offerId = offerId;
  });

  const showAllRoomsBtn = $result.find(".show-all-rooms-btn");
  showAllRoomsBtn.on("click", () => {
    $result.append(`
          <div class="loading-spinner waiting-spinner text-center">
              <div class="loading-animations">
                  <div class="spinner-border" style="width: 10rem; height: 10rem;" role="status">
                      <span class="visually-hidden"></span>
                  </div>
              </div>
              
              <div>just a moment...</div>
          </div>
          `);

    showAllRoomsBtn.remove();
    $(".order-room-btn").removeClass("mb-2").addClass("mb-4");
    const hotelId = result.hotel.hotelId;
    state.hotelId = hotelId;

    renderAllHotelRooms($result);
  });
}

async function renderAllHotelRooms($result) {
  try {
    const response = await $.ajax({
      url: `https://test.api.amadeus.com/v2/shopping/hotel-offers/by-hotel?hotelId=${state.hotelId}`,
      method: "GET",
      timeout: 0,
      headers: {
        Authorization: `Bearer ${state.ACCESS_TOKEN}`,
      },
    });

    $(".waiting-spinner").remove();
    const hotelRooms = response.data.offers;
    $result.find(".room-content").remove();

    hotelRooms.forEach((hotelRoom) => {
      const roomDescription = hotelRoom.room.description.text;
      const totalPrice = hotelRoom.price.total;
      const currency =
        hotelRoom.price.currency === "GBP" || "gbp"
          ? "£"
          : hotelRoom.price.currency;

      const roomEl = $(`
                      <hr>
                      <div class="room-content col-4">
                          <div class="room-description"><span class="room-description-title">Room Description:</span> ${roomDescription}</div>
                          <div class="ordering">
                              <div class="price mb-2">${totalPrice} <span>${currency}</span></div>
                              <button type="button" class="btn btn-danger btn-lg mb-4 order-room-btn" data-bs-toggle="modal" data-bs-target="#guest-modal">ORDER ROOM</button>
                          </div>
                      </div>
                  `);

      $result.append(roomEl);

      roomEl.find(".order-room-btn").on("click", () => {
        if ($(".booking-spinner")) {
          $(".booking-spinner").remove();
        }

        const offerId = hotelRoom.id;
        state.offerId = offerId;
      });
    });
  } catch (err) {
    console.log(err);
    $(".waiting-spinner").remove();

    const errorAlert = $(`
              <div class="alert alert-warning d-flex align-items-center error-alert" role="alert">
                  <svg class="bi flex-shrink-0 me-2" width="24" height="24" role="img" aria-label="Warning:"><use xlink:href="#exclamation-triangle-fill"/></svg>
                  <div>
                      We couldn't make it, please reload the page and try again.
                  </div>
              </div>`);

    ELEMENTS.$results.append(errorAlert);
  }
}

function createSearchingSpinner() {
  return ELEMENTS.$searchForm.after(`
          <div class="loading-spinner text-center">
              <div class="loading-animations">
                  <i class="fas fa-hotel"></i>
                  <div class="spinner-border" style="width: 10rem; height: 10rem;" role="status">
                      <span class="visually-hidden"></span>
                  </div>
                  <i class="fas fa-plane-departure"></i>
              </div>
              
              <div>searching...</div>
          </div>
      `);
}

function createBookingSpinner() {
  return ELEMENTS.$bookingForm.after(`
          <div class="loading-spinner booking-spinner text-center">
              <div class="loading-animations">
                  <div class="spinner-border" style="width: 10rem; height: 10rem;" role="status">
                      <span class="visually-hidden"></span>
                  </div>
              </div>
              
              <div>just a moment...</div>
          </div>
      `);
}
