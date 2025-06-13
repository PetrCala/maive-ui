# plumber.R

#* Echo back the input
#* @usage curl --data "a=4&b=3" "http://localhost:8787/sum"
#* @param msg The message to echo
#* @get /echo
function(msg = "") {
  list(msg = paste0("The message is: '", msg, "'"))
}

#* Plot a histogram
#* @serializer png
#* @get /plot
function() {
  rand <- rnorm(100)
  hist(rand)
}

#* Return the sum of two numbers
#* @usage curl "http://localhost:8787/echo?msg=hello"
#* @param a The first number to add
#* @param b The second number to add
#* @post /sum
function(a, b) {
  as.numeric(a) + as.numeric(b)
}

#* Run the model
#* @post /run-model
function(file_data, parameters) {
  print(file_data)
  print(parameters)
  list(msg = "Model run successfully")
}
