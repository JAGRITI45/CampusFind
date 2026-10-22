
// ========================================
// CampusFind - Lost and Found Management
// ========================================

// Report form elements
const reportSection = document.getElementById("reportSection");
const reportForm = document.getElementById("reportForm");
const formTitle = document.getElementById("formTitle");
const formMessage = document.getElementById("formMessage");
const submitBtn = document.getElementById("submitBtn");

// Homepage buttons
const lostBtn = document.getElementById("lostBtn");
const foundBtn = document.getElementById("foundBtn");
const cancelBtn = document.getElementById("cancelBtn");

// Search elements
const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const searchBtn = document.getElementById("searchBtn");
const clearBtn = document.getElementById("clearBtn");
const resultsMessage = document.getElementById("resultsMessage");
const itemsList = document.getElementById("itemsList");

// Contact elements
const contactSection = document.getElementById("contactSection");
const contactItemName = document.getElementById("contactItemName");
const contactName = document.getElementById("contactName");
const contactEmail = document.getElementById("contactEmail");
const contactPhone = document.getElementById("contactPhone");
const contactMessage = document.getElementById("contactMessage");
const closeContactBtn = document.getElementById("closeContactBtn");

// Current report type
let currentItemType = "Lost";

// ========================================
// 1. OPEN REPORT FORM
// ========================================

function openReportForm(type) {
    currentItemType = type;

    formTitle.textContent =
        type === "Lost" ? "Report a Lost Item" : "Report a Found Item";

    formMessage.textContent = "";
    reportSection.hidden = false;
    contactSection.hidden = true;

    reportSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

lostBtn.addEventListener("click", () => openReportForm("Lost"));
foundBtn.addEventListener("click", () => openReportForm("Found"));

// ========================================
// 2. CANCEL REPORT FORM
// ========================================

cancelBtn.addEventListener("click", () => {
    reportForm.reset();
    reportSection.hidden = true;
    formMessage.textContent = "";
});

// ========================================
// 3. SUBMIT REPORT
// ========================================

reportForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const itemData = {
        itemName: document.getElementById("itemName").value.trim(),
        category: document.getElementById("category").value,
        description: document.getElementById("description").value.trim(),
        location: document.getElementById("location").value.trim(),
        itemDate: document.getElementById("itemDate").value,
        itemType: currentItemType,
        reporterName: document.getElementById("reporterName").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        contactConsent: document.getElementById("contactConsent").checked
    };

    if (!itemData.contactConsent) {
        formMessage.textContent =
            "Please agree to share your contact details for item recovery.";
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    formMessage.textContent = "";

    try {
        const response = await fetch("/api/items", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(itemData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not submit report.");
        }

        formMessage.textContent = "Report submitted successfully!";
        reportForm.reset();

        await loadItems();

        setTimeout(() => {
            reportSection.hidden = true;
            formMessage.textContent = "";
        }, 1500);

    } catch (error) {
        console.error("Submit report error:", error);
        formMessage.textContent = error.message || "Please try again.";

    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Report";
    }
});

// ========================================
// 4. FORMAT DATE
// ========================================

function formatDate(dateValue) {
    if (!dateValue) return "Not specified";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return String(dateValue);
    }

    return date.toLocaleDateString("en-IN");
}

// ========================================
// 5. LOAD AND DISPLAY ITEMS
// ========================================

async function loadItems() {
    itemsList.innerHTML = "<p>Loading items...</p>";
    resultsMessage.textContent = "";

    const params = new URLSearchParams();
    const search = searchInput.value.trim();
    const type = typeFilter.value;

    if (search) params.append("search", search);
    if (type !== "All") params.append("type", type);

    try {
        const response = await fetch(`/api/items?${params.toString()}`);

        if (!response.ok) {
            throw new Error("Unable to load items.");
        }

        const items = await response.json();
        itemsList.innerHTML = "";

        if (!Array.isArray(items) || items.length === 0) {
            itemsList.innerHTML = "<p>No items found.</p>";
            resultsMessage.textContent = "No matching reports found.";
            return;
        }

        resultsMessage.textContent = `${items.length} report(s) found.`;

        items.forEach((item) => {
            const card = document.createElement("div");
            card.className = "item-card";

            const title = document.createElement("h3");
            title.textContent = item.item_name || "Unnamed item";

            const category = document.createElement("p");
            category.textContent =
                `Category: ${item.category || "Not specified"}`;

            const location = document.createElement("p");
            location.textContent =
                `Location: ${item.location || "Not specified"}`;

            const date = document.createElement("p");
            date.textContent = `Date: ${formatDate(item.item_date)}`;

            const status = document.createElement("p");
            status.className = "item-type";
            status.textContent =
                `${item.item_type || "Report"} · ${item.status || "Open"}`;

            const contactButton = document.createElement("button");
            contactButton.type = "button";
            contactButton.textContent = "Contact Reporter";

            contactButton.addEventListener("click", () => {
                showContact(item.id, item.item_name);
            });

            card.appendChild(title);
            card.appendChild(category);
            card.appendChild(location);
            card.appendChild(date);
            card.appendChild(status);
            card.appendChild(contactButton);

            // Show the return button only for items not yet returned.
            if (item.status !== "Returned") {
                const returnedButton = document.createElement("button");
                returnedButton.type = "button";
                returnedButton.textContent = "Mark as Returned";
                returnedButton.className = "secondary";

                returnedButton.addEventListener("click", () => {
                    markAsReturned(item.id, item.item_name);
                });

                card.appendChild(returnedButton);
            }

            itemsList.appendChild(card);
        });

    } catch (error) {
        console.error("Load items error:", error);
        itemsList.innerHTML =
            "<p>Could not load items. Please check the server.</p>";
    }
}

// ========================================
// 6. MARK ITEM AS RETURNED
// ========================================

async function markAsReturned(itemId, itemName) {
    const confirmed = window.confirm(
        `Are you sure you want to mark "${itemName}" as returned?`
    );

    if (!confirmed) return;

    try {
        const response = await fetch(`/api/items/${itemId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status: "Returned"
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not update item status.");
        }

        resultsMessage.textContent =
            `"${itemName}" has been marked as returned.`;

        await loadItems();

    } catch (error) {
        console.error("Mark as returned error:", error);
        window.alert(error.message || "Could not update the item status.");
    }
}

// ========================================
// 7. SEARCH AND FILTER
// ========================================

searchBtn.addEventListener("click", loadItems);

searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        loadItems();
    }
});

typeFilter.addEventListener("change", loadItems);

clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    typeFilter.value = "All";
    loadItems();
});

// ========================================
// 8. CONTACT REPORTER
// ========================================

async function showContact(itemId, itemName) {
    contactSection.hidden = false;
    contactSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    contactItemName.textContent = `Item: ${itemName || "Unnamed item"}`;
    contactName.textContent = "Loading...";
    contactEmail.textContent = "";
    contactEmail.removeAttribute("href");
    contactPhone.textContent = "";
    contactPhone.removeAttribute("href");
    contactMessage.textContent = "";

    try {
        const response = await fetch(`/api/items/${itemId}/contact`);
        const contact = await response.json();

        if (!response.ok) {
            throw new Error(
                contact.message || "Unable to load reporter details."
            );
        }

        contactName.textContent = contact.reporterName || "Not provided";

        if (contact.email) {
            contactEmail.textContent = contact.email;
            contactEmail.href = `mailto:${contact.email}`;
        } else {
            contactEmail.textContent = "Not provided";
        }

        if (contact.phone) {
            contactPhone.textContent = contact.phone;
            contactPhone.href = `tel:${contact.phone}`;
        } else {
            contactPhone.textContent = "Not provided";
        }

    } catch (error) {
        console.error("Contact details error:", error);
        contactName.textContent = "Unavailable";
        contactMessage.textContent =
            error.message || "Could not load contact details.";
    }
}

// ========================================
// 9. CLOSE CONTACT SECTION
// ========================================

closeContactBtn.addEventListener("click", () => {
    contactSection.hidden = true;
    contactMessage.textContent = "";
});

// ========================================
// 10. LOAD ITEMS ON PAGE OPEN
// ========================================

loadItems();
