enyo.kind({
	name: "kindle.userPreferences.AmazonLoginForm",
	kind: "Control",
	className: "loginFormBg",
	preventContentOverflow: false,
	pack: "center", align: "center",
	layoutKind: "VFlexLayout",
	events: {
		onRegisterInfoEntered: "",
		onCreateAcntClicked: "",
		onForgotPswClicked: "",
		onViewLicenseAgmtClicked: "",
		onInvalidCredentialsEntered: "",
		onJapanCustomerClicked: ""
	},
	components: [
		{kind: "Image", name: "kindleLogo", src: "images/kindle-logo.png", canGenerate: false},
		{kind: "Control", className: "loginFormBox", name: "loginBox", canGenerate: false, components: [
			{content: $L("Welcome to Kindle."), className: "loginFormTitle"},
			{content: $L("Register now to get started."), className: "loginFormDescription"},
			{className:"loginFormInputBox", components: [
				{kind: "Input", name: "loginUsername", hint: $L("Amazon account email address"), className:"enyo-input enyo-middle", autoCapitalize: "lowercase", inputType: "email", onkeypress: "testEnter", autocorrect: false, spellcheck: false},
				{className:"loginform-input-divider"},
				{kind: "PasswordInput", name: "loginPassword", hint: $L("Amazon.com password"), className:"enyo-input enyo-middle", onkeypress: "testEnter"},
			]},
			{kind: "VFlexBox", components: [
				{kind: "enyo.ActivityButton", name: "registerBtn", content: $L("Register this Kindle"), disabled: true, className:"register-btn", onmousedown: "submitRegistration"},
				{kind: "VFlexBox", components: [
					{kind: "Button", name: "forgotPswBtn", content: $L("Forgot your password?"), className: "", style: "text-decoration: underline; margin-bottom:10px", onclick: "forgotPswClick"},
					{content: $L("Don't have an Amazon.com account?"), className:"createacnt-desc"},
					{kind: "enyo.Button", name: "createAcntBtn", content: $L("Create one now"), className:"createacnt-btn", onclick: "createAcntClick"},
					{content: $L("By registering, you agree to the Kindle"), className:"createacnt-desc"},
					{kind: "Button", name: "licenseAgmtBtn", content: $L("License Agreement and Terms of Use."), className: "",  style: "text-decoration: underline; margin-bottom:10px", onclick: "licenseAgmtClick"},
				]}
			]},
		]},
		/* {kind: "Image", src: "images/amazon_logo.png", style: "margin-left: 120px"}, */
		{kind: "Popup", name: "errorPopup", scrim: true, components: [
			{content: $L("Invalid e-mail or password") },
			{kind: "Button", content: $L("OK"), name: "okInvalid", className: "enyo-button-light", onclick:"okClick"}
		]},
	],
	
	submitRegistration: function() {
		//Temporarily commented out until further notice:
        //var regUser = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
		var regPass = /\S/;

		var password = this.$.loginPassword.getValue();
		var usrName = enyo.string.trim(this.$.loginUsername.getValue());
		
		
		if(usrName.indexOf('@') == -1 || usrName.length < 4 || regPass.test(password) == false) {
			this.log("Wrong formatted login info");
			this.doInvalidCredentialsEntered();
		}
		// If UserName and Password entry is valid:
		else {
			this.log("Start register");
			this.$.registerBtn.setActive(true);
			this.$.registerBtn.setDisabled(true);
			this.doRegisterInfoEntered(usrName, password);
		}
	},
	
	registerSucceeded: function() {
		this.$.registerBtn.setActive(false);
		this.$.registerBtn.setDisabled(false);
		this.$.loginPassword.setValue("");
		this.$.loginUsername.setValue("");
        enyo.keyboard.setResizesWindow(false);
	},
	
	forgotPswClick: function() {
		this.doForgotPswClicked();
	},
	
	japanClick: function() {
		this.doJapanCustomerClicked();
	},

	licenseAgmtClick: function() {
		this.doViewLicenseAgmtClicked();
	},

	createAcntClick: function() {
		this.doCreateAcntClicked();
	},

	cancelClick: function() {

	},
	
	showLogin: function() {
		this.$.kindleLogo.canGenerate = true;
		this.$.loginBox.canGenerate = true;
		this.render();
		this.$.loginBox.render(); // This is needed otherwise loginUsername.getValue sometimes returns an empty string (TODO: consider another alternative?)
        enyo.keyboard.setResizesWindow(true);
        this.$.registerBtn.setDisabled(true);
	},
	
	okClick: function() {
		this.$.errorPopup.close();
	},

	invalidEntry: function() {
		this.$.registerBtn.setActive(false);
		this.$.registerBtn.setDisabled(false);
	},
	
	testEnter: function(inSender, key) {
        
		var password = this.$.loginPassword.getValue();
		var usrName = this.$.loginUsername.getValue();
        
        if (password.length > 0 && usrName.length > 0)
        {
            this.$.registerBtn.setDisabled(false);
            
            if (key.keyCode == 13) {
			inSender.forceBlur();
			this.submitRegistration();
		}
        }
        else
        {
            this.$.registerBtn.setDisabled(true);
        }
	}
});
