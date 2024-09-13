var app = new Vue({
    el: "#app",
    data: {
        mode: "",
        bizName: "",
        sellerName: "",
        bankAccount: "",
        phoneNumber: "",
        licensePlate: "",
        vehicleDescription: "",
        sellPrice: "",
        vehicleModel: "",
        showTakeBackOption: false,
        errors: []
    },
    methods: {
        sell(sellPrice) {
            this.errors = [];
            if (this.sellPrice != "") {
                if (!isNaN(sellPrice)) {
                    const requestOptions = {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            price: this.sellPrice,
                            desc: this.vehicleDescription,
                        })
                    };
                    fetch(`https://${GetParentResourceName()}/sellVehicle`, requestOptions);
                    this.close();
                } else {
                    this.errors.push("Preço precisa ser apenas número.");
                }
            } else {
                this.errors.push("Preencha um preço de venda.")
            }
        },
        buy() {
            const requestOptions = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            };
            fetch(`https://${GetParentResourceName()}/buyVehicle`, requestOptions);
            this.close();
        },
        takeBack() {
            const requestOptions = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            };
            fetch(`https://${GetParentResourceName()}/takeVehicleBack`, requestOptions);
            this.close();
        },
        close() {
            const requestOptions = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            };
            fetch(`https://${GetParentResourceName()}/close`, requestOptions);

            this.resetForm();
            this.hideForm();

        },
        resetForm() {
            this.sellerName = "";
            this.bankAccount = "";
            this.phoneNumber = "";
            this.licensePlate = "";
            this.vehicleDescription = "";
            this.sellPrice = "";
            this.vehicleModel = "";
            this.errors = [];
        },
        hideForm() {
            document.body.style.display = "none";
        }

    },
    computed: {
        tax() {
            return (this.sellPrice / 100 * 15).toFixed(0);
        },
        mosleys() {
            return (this.sellPrice / 100 * 5).toFixed(0);
        },
        total() {
            return (this.sellPrice / 100 * 80).toFixed(0);
        }
    }

});

function setupForm(data) {
    if(data.action === "sellVehicle" || data.action === "buyVehicle") {
        document.body.style.display = "block";
    }

    app.mode = data.action;

    app.showTakeBackOption = data.showTakeBackOption;

    app.bizName = data.bizName;

    app.sellerName = data.sellerData.firstname + " " + data.sellerData.lastname;
    app.bankAccount = data.sellerData.account;
    app.phoneNumber = data.sellerData.phone;
    app.licensePlate = data.plate;
    app.vehicleModel = data.model.charAt(0).toUpperCase() + data.model.slice(1);

    if (data.action === "buyVehicle") {
        app.vehicleDescription = data.vehicleData.desc;
        app.sellPrice = data.vehicleData.price;

        if (app.vehicleDescription == "") {
            app.vehicleDescription = `O vendedor não preencheu nenhuma descrição.`
        }
    }
}

document.onreadystatechange = () => {
    if (document.readyState === "complete") {
        window.addEventListener("message", (event) => {
            this.setupForm(event.data);
        });
    }
};

/* Handle escape key press to close the menu */
document.onkeyup = function (data) {
    if (data.key != "Escape") return;

    app.close();
};
