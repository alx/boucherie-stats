require 'rubygems'
require 'date'
require 'csv'

class DataGenerator

  def run
    File.open('data_sample.csv', 'w') do |f|
      f.write "fournisseur,piece,price,timestamp"
    end

    data = [
      ['Maurice', 'Langue', 40],
      ['Maurice', 'Abats', 30],
      ['Maurice', 'Tournedos', 20],
      ['Samuel', 'Langue', 40],
      ['Marrcel', 'Langue', 40],
    ]

    start_date = DateTime.parse("01/01/2012").to_time.to_i

    data.each do |info|
      timestamp = start_date
      while timestamp < Time.now.to_i
        CSV.open('data_sample.csv', 'a') do |csv|
          csv << generate_cvs_row(info[0], info[1], info[2], timestamp)
        end
        # make a new row next week
        timestamp += 60 * 60 * 24 * 7
      end
    end
  end

  private

  def generate_cvs_row(fournisseur, piece, medium_price, timestamp)
    return [fournisseur, piece, (((rand(1000) / 30.5) + medium_price) * 100).floor / 100.0, timestamp]
  end
end

gen = DataGenerator.new
gen.run
